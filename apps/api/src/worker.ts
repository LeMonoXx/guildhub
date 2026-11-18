import path from "node:path";
import { contentLocales } from "@guildhub/contracts";
import { composeGuild } from "./composition.js";
import {
  makeBakeLook,
  makeEnsureBosses,
  makeEnsureFixedLook,
  makeEnsureWorldMap,
  makePrebakeBodies,
  makeRebakeLooks,
  publicIconUrl,
} from "./modules/character/index.js";
import {
  BakerProcess,
  makeBattleNetPlayableRaceSource,
  makeDrizzleCharacterCache,
  makeFileBakeProgressSink,
  makeFilePrebakeLedger,
  makeFilesystemModelAssetStore,
  makeFilesystemWorldMapAssets,
  makeServeModelBaker,
  registerModelJobs,
} from "./modules/character/infrastructure/index.js";
import { makeAnnounceCelebrations } from "./modules/celebrations/index.js";
import { makeDiscordWebhookNotifier } from "./modules/celebrations/infrastructure/index.js";
import { makeRefreshRecipeCatalog } from "./modules/crafting/index.js";
import {
  makeBattleNetRecipeCatalogSource,
  makeDrizzleRecipeCatalogStore,
  registerRecipeJobs,
} from "./modules/crafting/infrastructure/index.js";
import {
  calendarDay,
  makeRecordGuildCheck,
  type OnHistoryChanges,
} from "./modules/history/index.js";
import { registerHistoryJobs } from "./modules/history/infrastructure/index.js";
import { BOSS_DISPLAY_IDS } from "./modules/party/index.js";
import { readEnv } from "./platform/config/env.js";
import { loadInstanceConfig } from "./platform/config/instance.js";
import { createDatabase } from "./platform/db/client.js";
import { startJobQueue } from "./platform/jobs/queue.js";
import { systemClock } from "./platform/kernel/clock.js";
import {
  onShutdownSignal,
  runShutdownSteps,
} from "./platform/lifecycle/shutdown.js";
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
void makeEnsureWorldMap({
  assets: makeFilesystemWorldMapAssets(assetRoot),
  baker,
})().then(
  (state) => {
    if (state === "baked") logger.info({ module: "baker" }, "world map baked");
  },
  (error: unknown) => {
    logger.error({ module: "baker", err: error }, "world map bake failed");
  },
);
void makeEnsureBosses({ baker, displayIds: BOSS_DISPLAY_IDS })().then(
  (result) => {
    logger.info({ module: "baker", ...result }, "dungeon bosses ready");
  },
  (error: unknown) => {
    logger.error({ module: "baker", err: error }, "dungeon boss bake failed");
  },
);

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

const bakeLook = makeBakeLook({
  baker,
  progress: makeFileBakeProgressSink(assetRoot),
});
await registerModelJobs(boss, {
  bakeLook,
  bakeFile: (job) => baker.bakeFile(job),
  prebakeBodies: makePrebakeBodies({
    baker,
    races: makeBattleNetPlayableRaceSource(composed.battleNet),
    ledger: makeFilePrebakeLedger(path.join(bakerCache, "prebake.json")),
  }),
  rebakeLooks: makeRebakeLooks({
    baker,
    assets,
    bakeLook,
    roster: async () => {
      const roster = await composed.getGuildRoster(composed.guild);
      return roster.ok ? roster.value.data : [];
    },
    cache: makeDrizzleCharacterCache(database),
  }),
  stopping: () => shuttingDown,
  timeZone: env.HISTORY_TIME_ZONE,
  log: logger,
});
const celebrate = (webhookUrl: string): OnHistoryChanges => {
  const announce = makeAnnounceCelebrations({
    notifier: makeDiscordWebhookNotifier({
      webhookUrl,
      siteUrl: new URL(env.BATTLENET_REDIRECT_URI).origin,
      locale: env.DISCORD_LOCALE,
    }),
    locale: env.DISCORD_LOCALE,
  });
  return async (events, locale) => {
    try {
      const count = await announce(events, locale);
      if (count > 0)
        logger.info({ module: "celebrations", count }, "celebrations posted");
    } catch (error) {
      logger.warn(
        { module: "celebrations", err: error },
        "celebrations not posted",
      );
    }
  };
};

await registerHistoryJobs(boss, {
  guild: composed.guild,
  recordGuildCheck: makeRecordGuildCheck({
    getGuild: composed.getGuild,
    getRoster: composed.getGuildRoster,
    loadProfiles: composed.loadProfiles,
    locales: contentLocales,
    ...composed.history,
    ...(env.DISCORD_WEBHOOK_URL === undefined
      ? {}
      : { onChanges: celebrate(env.DISCORD_WEBHOOK_URL) }),
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
  shuttingDown = true;
  logger.info({ module: "lifecycle", signal }, "worker shutdown started");
  bakerProcess.stop();
  await runShutdownSteps(logger, [
    {
      name: "job queue stop",
      run: () => boss.stop({ graceful: true, timeout: 10_000 }),
      required: false,
    },
    { name: "database close", run: () => database.close(), required: false },
    {
      name: "telemetry shutdown",
      run: () => telemetry.shutdown(),
      required: false,
    },
  ]);
  logger.flush();
  process.exit(0);
}

onShutdownSignal((signal) => {
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
