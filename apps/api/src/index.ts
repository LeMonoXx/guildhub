import {
  createGuildBattleNetClient,
  makeBattleNetGuildSource,
  makeDrizzleGuildCache,
  makeGetGuild,
  makeGetGuildRoster,
  registerGuild,
} from "./modules/guild/index.js";
import { readEnv } from "./platform/config/env.js";
import { loadInstanceConfig } from "./platform/config/instance.js";
import { createDatabase } from "./platform/db/client.js";
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
const battleNet = await createGuildBattleNetClient({
  key: env.BATTLENET_CLIENT_ID,
  secret: env.BATTLENET_CLIENT_SECRET,
  origin: instance.region,
  apiBaseUrl: env.BATTLENET_API_BASE_URL,
});
const guildCache = makeDrizzleGuildCache(database);
const guildSource = makeBattleNetGuildSource(battleNet);
const guildDeps = {
  source: guildSource,
  cache: guildCache,
  clock: systemClock,
  maxAgeMs: env.GUILD_CACHE_TTL_SECONDS * 1000,
};
registerGuild(app, {
  instance,
  getGuild: makeGetGuild(guildDeps),
  getGuildRoster: makeGetGuildRoster(guildDeps),
  onStaleCache: (kind) => {
    logger.warn({ module: "guild", kind }, "serving stale guild cache");
  },
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
