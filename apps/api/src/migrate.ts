import { readEnv } from "./platform/config/env.js";
import { createLogger } from "./platform/observability/logger.js";
import { createMigrationDatabase } from "./platform/db/client.js";
import { applyMigrations } from "./platform/db/migrate.js";

const env = readEnv(process.env);
const logger = createLogger({
  level: env.LOG_LEVEL,
  serviceName: "guildhub-migrate",
});
const database = createMigrationDatabase(env.DATABASE_URL);

try {
  logger.info({ module: "migrate" }, "applying migrations");
  await applyMigrations(database);
  logger.info({ module: "migrate" }, "migrations applied");
} catch (error) {
  logger.error({ module: "migrate", err: error }, "migrations failed");
  process.exitCode = 1;
} finally {
  await database.close();
  logger.flush();
}
