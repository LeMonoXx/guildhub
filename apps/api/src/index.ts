import {
  makeGetGuildChronicle,
  registerChronicle,
} from "./modules/chronicle/index.js";
import { composeGuild } from "./composition.js";
import {
  makeGetCharacter,
  makeGetCharacterAvatar,
  makeGetCharacterProfile,
  makeGetCharacterRender,
  makeGetItemIcon,
  makePresentFeaturedMembers,
  makePresentRosterMembers,
  registerCharacter,
} from "./modules/character/index.js";
import {
  ensureModelQueues,
  makeBattleNetCharacterSource,
  makeDrizzleCharacterCache,
  makeFilesystemModelAssetStore,
  makeHttpCharacterMediaGateway,
  makeNoopModelBuildQueue,
  makePgBossModelBuildQueue,
} from "./modules/character/infrastructure/index.js";
import {
  makeGetFeaturedMembers,
  registerGuild,
} from "./modules/guild/index.js";
import {
  makeGetCharacterHistory,
  makeGetGuildHistory,
  registerHistory,
} from "./modules/history/index.js";
import {
  makeLoadGuildCrafters,
  makeSearchRecipes,
  registerCrafting,
} from "./modules/crafting/index.js";
import { makeDrizzleRecipeCatalogStore } from "./modules/crafting/infrastructure/index.js";
import { readEnv } from "./platform/config/env.js";
import { loadInstanceConfig } from "./platform/config/instance.js";
import { createDatabase } from "./platform/db/client.js";
import { startJobQueue } from "./platform/jobs/queue.js";
import { systemClock } from "./platform/kernel/clock.js";
import { startTelemetry } from "./platform/observability/telemetry.js";

const env = readEnv(process.env);
const telemetry = startTelemetry({
  endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  serviceName: env.OTEL_SERVICE_NAME,
});
const instance = await loadInstanceConfig(env.INSTANCE_DIR);
const database = createDatabase(env.DATABASE_URL);
const [{ createLogger }, { serve }, { createApp }] = await Promise.all([
  import("./platform/observability/logger.js"),
  import("@hono/node-server"),
  import("./platform/http/app.js"),
]);
const logger = createLogger({
  level: env.LOG_LEVEL,
  serviceName: env.OTEL_SERVICE_NAME,
});
const app = createApp({
  logger,
  serviceName: env.OTEL_SERVICE_NAME,
  database,
});
const {
  battleNet,
  getGuild,
  getGuildRoster,
  profileDeps,
  loadProfiles,
  history,
} = await composeGuild({ env, instance, database });
const characterCache = makeDrizzleCharacterCache(database);
const characterSource = makeBattleNetCharacterSource(battleNet);
const assets = makeFilesystemModelAssetStore(env.ASSET_ROOT);
let jobQueue = makeNoopModelBuildQueue();
let jobBoss: Awaited<ReturnType<typeof startJobQueue>> | undefined;
try {
  jobBoss = await startJobQueue(env.DATABASE_URL);
  await ensureModelQueues(jobBoss);
  jobQueue = makePgBossModelBuildQueue(jobBoss);
} catch (error) {
  logger.warn(
    { module: "jobs", err: error },
    "job queue unavailable; look requests still write to the asset store",
  );
}
const lookDeps = {
  source: characterSource,
  cache: characterCache,
  assets,
  queue: jobQueue,
  clock: systemClock,
  maxAgeMs: env.CHARACTER_CACHE_TTL_SECONDS * 1000,
  fallbackBuild: env.MODEL_CLIENT_BUILD ?? "wowf",
};
const onStaleCache = (kind: "profile" | "roster"): void => {
  logger.warn({ module: "guild", kind }, "serving stale guild cache");
};
registerGuild(app, {
  instance,
  getGuild,
  getGuildRoster,
  getFeaturedMembers: makeGetFeaturedMembers({ getRoster: getGuildRoster }),
  presentRosterMembers: makePresentRosterMembers({ cache: characterCache }),
  presentFeaturedMembers: makePresentFeaturedMembers(lookDeps),
  onStaleCache,
});
const media = makeHttpCharacterMediaGateway({
  iconBaseUrls: [
    `https://render.worldofwarcraft.com/forever-${instance.region}`,
    `https://render.worldofwarcraft.com/${instance.region}`,
  ],
});
registerCharacter(app, {
  instance,
  getCharacter: makeGetCharacter({
    getRoster: getGuildRoster,
    ...lookDeps,
  }),
  getCharacterRender: makeGetCharacterRender({
    getRoster: getGuildRoster,
    cache: characterCache,
    media,
  }),
  getCharacterProfile: makeGetCharacterProfile({
    getRoster: getGuildRoster,
    ...profileDeps,
  }),
  getCharacterAvatar: makeGetCharacterAvatar({
    getRoster: getGuildRoster,
    cache: characterCache,
    media,
  }),
  getItemIcon: makeGetItemIcon({ media }),
  onStaleCache: () => {
    onStaleCache("roster");
  },
});
registerChronicle(app, {
  instance,
  getGuildChronicle: makeGetGuildChronicle({
    getGuild,
    getRoster: getGuildRoster,
    loadProfiles,
  }),
});
registerHistory(app, {
  instance,
  getGuildHistory: makeGetGuildHistory(history),
  getCharacterHistory: makeGetCharacterHistory(history),
});
registerCrafting(app, {
  searchRecipes: makeSearchRecipes({
    store: makeDrizzleRecipeCatalogStore(database),
    loadCrafters: makeLoadGuildCrafters({
      guild: { slug: instance.guild.slug },
      getRoster: getGuildRoster,
      loadProfiles,
    }),
    clock: systemClock,
    reloadAfterMs: 5 * 60 * 1000,
  }),
});

const server = serve(
  { fetch: app.fetch, hostname: "0.0.0.0", port: env.PORT },
  (info) => {
    logger.info(
      {
        module: "lifecycle",
        port: info.port,
        instance: instance.slug,
        telemetry: telemetry.enabled,
      },
      "API listening",
    );
  },
);

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ module: "lifecycle", signal }, "shutdown started");

  server.close((error) => {
    void finishShutdown(error);
  });
  if ("closeIdleConnections" in server) server.closeIdleConnections();
  setTimeout(() => {
    logger.error({ module: "lifecycle" }, "graceful shutdown timed out");
    process.exit(1);
  }, 10_000).unref();
}

async function finishShutdown(error?: Error): Promise<void> {
  if (error !== undefined) {
    logger.error({ module: "lifecycle", err: error }, "server close failed");
  }
  try {
    await jobBoss?.stop({ graceful: true, timeout: 5000 });
  } catch (queueError) {
    logger.error(
      { module: "lifecycle", err: queueError },
      "job queue stop failed",
    );
    error ??= new Error("job queue stop failed");
  }
  try {
    await database.close();
  } catch (closeError) {
    logger.error(
      { module: "lifecycle", err: closeError },
      "database close failed",
    );
    error ??= new Error("database close failed");
  }
  try {
    await telemetry.shutdown();
  } catch (telemetryError) {
    logger.error(
      { module: "lifecycle", err: telemetryError },
      "telemetry shutdown failed",
    );
  }
  logger.flush();
  process.exit(error === undefined ? 0 : 1);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
