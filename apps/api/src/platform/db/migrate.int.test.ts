import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { describe, expect, it } from "vitest";
import {
  createMigrationDatabase,
  migrationsAreApplied,
  pingDatabase,
} from "./client.js";
import { applyMigrations, hasCommittedMigrations } from "./migrate.js";

describe("database migrations", () => {
  it("applies committed SQL onto PostgreSQL 18", async () => {
    const container = await new PostgreSqlContainer(
      "postgres:18-alpine",
    ).start();
    const database = createMigrationDatabase(container.getConnectionUri());
    try {
      await applyMigrations(database);
      await pingDatabase(database);
      if (hasCommittedMigrations()) {
        expect(await migrationsAreApplied(database)).toBe(true);
      }
    } finally {
      await database.close();
      await container.stop();
    }
  });
});
