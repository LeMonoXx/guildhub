import { access } from "node:fs/promises";
import path from "node:path";
import { contentLocales } from "@guildhub/contracts";
import { composeGuild } from "./composition.js";
import { readEnv } from "./platform/config/env.js";
import { loadInstanceConfig } from "./platform/config/instance.js";
import { createDatabase } from "./platform/db/client.js";
import { startTelemetry } from "./platform/observability/telemetry.js";
import {
  BakerProcess,
  CONVERT_QUEUE,
  LOOK_QUEUE,
  PREBAKE_QUEUE,
  fetchPlayableRaceIds,
  reportLookProgress,
  schedulePrebake,
  startJobQueue,
  type ConvertFileJob,
  type LookBakeDocument,
} from "./modules/character/index.js";
import {
  HISTORY_QUEUE,
  calendarDay,
  makeRecordGuildDay,
  scheduleHistory,
} from "./modules/history/index.js";
import { publicIconUrl } from "./modules/character/index.js";
import {
  RECIPE_QUEUE,
  makeBattleNetRecipeCatalogSource,
  makeDrizzleRecipeCatalogStore,
  makeRefreshRecipeCatalog,
  scheduleRecipeCatalog,
} from "./modules/crafting/index.js";
import { systemClock } from "./platform/kernel/clock.js";

const env = readEnv(process.env);
const telemetry = startTelemetry({
  endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  serviceName: `${env.OTEL_SERVICE_NAME}-worker`,
});
const [{ createLogger }] = await Promise.all([
  import("./platform/observability/logger.js"),
]);
const logger = createLogger({
  level: env.LOG_LEVEL,
  serviceName: `${env.OTEL_SERVICE_NAME}-worker`,
});

const assetRoot = requiredEnv(env.ASSET_ROOT, "ASSET_ROOT");
const bakerCli = requiredEnv(env.BAKER_CLI, "BAKER_CLI");
const bakerCache = env.BAKER_CACHE ?? path.join(assetRoot, ".cache");
/** An open game storage holds most of a small host's memory; give it back between runs. */
const BAKER_IDLE_MS = 2 * 60 * 1000;
/** Every body comes in both sexes the game knows. */
const SEXES = [0, 1] as const;

const baker = new BakerProcess({
  command: bakerCli.endsWith(".dll") ? "dotnet" : bakerCli,
  args: [
    ...(bakerCli.endsWith(".dll") ? [bakerCli] : []),
    "serve",
    "--output",
    assetRoot,
    "--cache",
    bakerCache,
    "--region",
    env.BAKER_REGION,
  ],
  idleMs: BAKER_IDLE_MS,
  log: (line) => {
    logger.info({ module: "baker" }, line);
  },
});

await ensureFixedLook();

const boss = await startJobQueue(env.DATABASE_URL);
boss.on("error", (error) => {
  logger.error({ module: "jobs", err: error }, "job queue error");
});
await boss.work(LOOK_QUEUE, async (jobs) => {
  for (const job of jobs) {
    await bakeLook(job.data as LookBakeDocument);
  }
});
await boss.work(CONVERT_QUEUE, async (jobs) => {
  for (const job of jobs) {
    await bakeFile(job.data as ConvertFileJob);
  }
});

const database = createDatabase(env.DATABASE_URL);
const composed = await composeGuild({
  env,
  instance: await loadInstanceConfig(env.INSTANCE_DIR),
  database,
});
const recordGuildDay = makeRecordGuildDay({
  getGuild: composed.getGuild,
  getRoster: composed.getGuildRoster,
  loadProfiles: composed.loadProfiles,
  locales: contentLocales,
  ...composed.history,
});
await scheduleHistory(
  boss,
  { cron: env.HISTORY_CRON, timeZone: env.HISTORY_TIME_ZONE },
  calendarDay(composed.history.clock.now(), env.HISTORY_TIME_ZONE),
);
await boss.work(HISTORY_QUEUE, async () => {
  const recorded = await recordGuildDay(composed.guild);
  if (!recorded.ok) {
    logger.warn(
      { module: "history", code: recorded.error.code },
      "guild day not recorded",
    );
    throw new Error(`guild day not recorded: ${recorded.error.code}`);
  }
  logger.info(
    {
      module: "history",
      day: recorded.value.day,
      members: recorded.value.members.length,
    },
    "guild day recorded",
  );
});

const refreshRecipes = makeRefreshRecipeCatalog({
  source: makeBattleNetRecipeCatalogSource(composed.battleNet, publicIconUrl),
  store: makeDrizzleRecipeCatalogStore(database),
  clock: systemClock,
  locales: contentLocales,
});
await scheduleRecipeCatalog(
  boss,
  env.HISTORY_TIME_ZONE,
  calendarDay(systemClock.now(), env.HISTORY_TIME_ZONE),
);
await boss.work(RECIPE_QUEUE, async () => {
  const refreshed = await refreshRecipes();
  if (!refreshed.ok) {
    logger.warn(
      {
        module: "crafting",
        code: refreshed.error.code,
        detail: refreshed.error.detail,
      },
      "recipe catalog not refreshed",
    );
    throw new Error(`recipe catalog not refreshed: ${refreshed.error.code}`);
  }
  logger.info(
    { module: "crafting", recipes: refreshed.value.recipes },
    "recipe catalog refreshed",
  );
});

await schedulePrebake(boss, env.HISTORY_TIME_ZONE);
await boss.work(PREBAKE_QUEUE, async () => {
  await prebakeBodies();
});

logger.info({ module: "lifecycle" }, "model worker listening");

let shuttingDown = false;
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ module: "lifecycle", signal }, "worker shutdown started");
  baker.stop();
  try {
    await boss.stop({ graceful: true, timeout: 10_000 });
  } catch (error) {
    logger.error({ module: "lifecycle", err: error }, "job queue stop failed");
  }
  try {
    await database.close();
  } catch (error) {
    logger.error({ module: "lifecycle", err: error }, "database close failed");
  }
  try {
    await telemetry.shutdown();
  } catch (error) {
    logger.error(
      { module: "lifecycle", err: error },
      "telemetry shutdown failed",
    );
  }
  logger.flush();
  process.exit(0);
}

process.once("SIGTERM", (signal) => {
  void shutdown(signal);
});
process.once("SIGINT", (signal) => {
  void shutdown(signal);
});

/** Pending and unpublished characters show the fixed look, and only the baker writes current.json. */
async function ensureFixedLook(): Promise<void> {
  const fixedLook = path.join(assetRoot, "looks", "fixed", "look.json");
  const present = await access(fixedLook).then(
    () => true,
    () => false,
  );
  if (present) return;
  logger.info({ module: "baker" }, "fixed look missing, baking it");
  try {
    await baker.run({ command: "fixed" });
    logger.info({ module: "baker" }, "fixed look baked");
  } catch (error) {
    logger.error({ module: "baker", err: error }, "fixed look bake failed");
  }
}

async function bakeLook(job: LookBakeDocument): Promise<void> {
  const progress = reportLookProgress(assetRoot, job.lookHash);
  const started = Date.now();
  try {
    await baker.run({ command: "look", look: job }, { listener: progress });
    logger.info(
      { module: "baker", lookHash: job.lookHash, ms: Date.now() - started },
      "look baked",
    );
  } finally {
    await progress.finish();
  }
}

async function bakeFile(job: ConvertFileJob): Promise<void> {
  await baker.run({
    command: "file",
    kind: job.kind,
    fileId: job.fileId,
    ...(job.modelFileId === undefined ? {} : { modelFileId: job.modelFileId }),
    ...(job.animationId === undefined ? {} : { animationId: job.animationId }),
  });
}

/**
 * Bakes every playable body with all its appearance textures once per game
 * build, so a member's first look only adds gear. Real looks go first.
 */
async function prebakeBodies(): Promise<void> {
  const races = await fetchPlayableRaceIds(composed.battleNet);
  if (!races.ok) {
    logger.warn(
      { module: "baker", code: races.error.code, detail: races.error.detail },
      "playable races unavailable",
    );
    throw new Error(`playable races unavailable: ${races.error.code}`);
  }
  let baked = 0;
  let failed = 0;
  for (const race of races.value) {
    for (const sex of SEXES) {
      try {
        const result = await baker.run(
          { command: "prebake", race, sex },
          { priority: "background" },
        );
        if (result.skipped !== true) baked++;
      } catch (error) {
        failed++;
        logger.warn(
          { module: "baker", race, sex, err: error },
          "prebake failed",
        );
      }
    }
  }
  if (baked > 0 || failed > 0)
    logger.info(
      { module: "baker", races: races.value.length, baked, failed },
      "bodies prebaked",
    );
}

function requiredEnv(value: string | undefined, name: string): string {
  if (value !== undefined) return value;
  logger.error(
    { module: "worker", name },
    `${name} is required for the model worker`,
  );
  throw new Error(`${name} is required for the model worker`);
}
