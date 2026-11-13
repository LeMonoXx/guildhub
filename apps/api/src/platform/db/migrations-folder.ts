import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const defaultMigrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../drizzle",
);

export function hasCommittedMigrations(
  migrationsFolder = defaultMigrationsFolder,
): boolean {
  try {
    return readdirSync(migrationsFolder, { withFileTypes: true }).some(
      (entry) => entry.isDirectory(),
    );
  } catch {
    return false;
  }
}
