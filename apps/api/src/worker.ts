import path from "node:path";
import { contentLocales } from "@guildhub/contracts";
import { composeGuild } from "./composition.js";
import {
  makeBakeLook,
  makeEnsureFixedLook,
  makePrebakeBodies,
  publicIconUrl,
} from "./modules/character/index.js";
import {
  BakerProcess,
  makeBattleNetPlayableRaceSource,
  makeFileBakeProgressSink,
  makeFilesystemModelAssetStore,
  makeServeModelBaker,
  registerModelJobs,
} from "./modules/character/infrastructure/index.js";
import { makeRefreshRecipeCatalog } from "./modules/crafting/index.js";
import {
  makeBattleNetRecipeCatalogSource,
  makeDrizzleRecipeCatalogStore,
  registerRecipeJobs,
} from "./modules/crafting/infrastructure/index.js";
import { calendarDay, makeRecordGuildDay } from "./modules/history/index.js";
import { registerHistoryJobs } from "./modules/history/infrastructure/index.js";
import { readEnv } from "./platform/config/env.js";
import { loadInstanceConfig } from "./platform/config/instance.js";
import { createDatabase } from "./platform/db/client.js";
import { startJobQueue } from "./platform/jobs/queue.js";
import { systemClock } from "./platform/kernel/clock.js";
import { startTelemetry } from "./platform/observability/telemetry.js";

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
/** The baker yields the CPU to the site; on a one-core host a bake would otherwise stall requests. */
const lowPriority = process.platform === "linux" ? ["nice", "-n", "10"] : [];
const bakerCommand = [
  ...lowPriority,
  ...(bakerCli.endsWith(".dll") ? ["dotnet", bakerCli] : [bakerCli]),
];
let shuttingDown = false;

const bakerProcess = new BakerProcess({
  command: bakerCommand[0] ?? bakerCli,
  args: [
    ...bakerCommand.slice(1),
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
const baker = makeServeModelBaker(bakerProcess);
const assets = makeFilesystemModelAssetStore(assetRoot);

try {
  const fixed = await makeEnsureFixedLook({ assets, baker })();
  if (fixed === "baked") logger.info({ module: "baker" }, "fixed look baked");
} catch (error) {
  logger.error({ module: "baker", err: error }, "fixed look bake failed");
}

const boss = await startJobQueue(env.DATABASE_URL);
boss.on("error", (error) => {
  logger.error({ module: "jobs", err: error }, "job queue error");
});

const database = createDatabase(env.DATABASE_URL);
const composed = await composeGuild({
  env,
  instance: await loadInstanceConfig(env.INSTANCE_DIR),
  database,
});
const today = calendarDay(systemClock.now(), env.HISTORY_TIME_ZONE);

await registerModelJobs(boss, {
  bakeLook: makeBakeLook({
    baker,
    progress: makeFileBakeProgressSink(assetRoot),
  }),
  bakeFile: (job) => baker.bakeFile(job),
  prebakeBodies: makePrebakeBodies({
    baker,
    races: makeBattleNetPlayableRaceSource(composed.battleNet),
  }),
  stopping: () => shuttingDown,
  timeZone: env.HISTORY_TIME_ZONE,
  log: logger,
});
await registerHistoryJobs(boss, {
  guild: composed.guild,
  recordGuildDay: makeRecordGuildDay({
    getGuild: composed.getGuild,
    getRoster: composed.getGuildRoster,
    loadProfiles: composed.loadProfiles,
    locales: contentLocales,
    ...composed.history,
  }),
  cron: env.HISTORY_CRON,
  timeZone: env.HISTORY_TIME_ZONE,
  today,
  log: logger,
});
await registerRecipeJobs(boss, {
  refreshRecipes: makeRefreshRecipeCatalog({
    source: makeBattleNetRecipeCatalogSource(composed.battleNet, publicIconUrl),
    store: makeDrizzleRecipeCatalogStore(database),
    clock: systemClock,
    locales: contentLocales,
  }),
  timeZone: env.HISTORY_TIME_ZONE,
  today,
  log: logger,
});

logger.info({ module: "lifecycle" }, "model worker listening");

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ module: "lifecycle", signal }, "worker shutdown started");
  bakerProcess.stop();
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

function requiredEnv(value: string | undefined, name: string): string {
  if (value !== undefined) return value;
  logger.error(
    { module: "worker", name },
    `${name} is required for the model worker`,
  );
  throw new Error(`${name} is required for the model worker`);
}
