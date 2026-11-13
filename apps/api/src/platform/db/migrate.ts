import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Database } from "./client.js";
import {
  defaultMigrationsFolder,
  hasCommittedMigrations,
} from "./migrations-folder.js";

export { hasCommittedMigrations } from "./migrations-folder.js";

export async function applyMigrations(
  database: Database,
  migrationsFolder = defaultMigrationsFolder,
): Promise<void> {
  if (!hasCommittedMigrations(migrationsFolder)) return;
  await migrate(database.db, { migrationsFolder });
}
