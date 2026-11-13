import { readEnv } from "./platform/config/env.js";
import { loadInstanceConfig } from "./platform/config/instance.js";
import { startTelemetry } from "./platform/observability/telemetry.js";

const env = readEnv(process.env);
const telemetry = startTelemetry({
  endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  serviceName: env.OTEL_SERVICE_NAME,
});
const instance = await loadInstanceConfig(env.INSTANCE_DIR);
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
