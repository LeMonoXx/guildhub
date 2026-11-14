import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../../../platform/db/client.js";
import { applyMigrations } from "../../../platform/db/migrate.js";
import { makeDrizzleCharacterCache } from "./drizzle-character-cache.js";

const fetchedAt = new Date("2026-11-13T12:00:00.000Z");

describe("drizzle character cache", () => {
  it("stores and reads a character snapshot", async () => {
    const container = await new PostgreSqlContainer(
      "postgres:18-alpine",
    ).start();
    const database = createMigrationDatabase(container.getConnectionUri());
    try {
      await applyMigrations(database);
      const cache = makeDrizzleCharacterCache(database);
      await cache.save({
        characterId: "101",
        slug: "guildmaster-example",
        name: "Guildmaster",
        surname: "Example",
        status: "found",
        facts: {
          raceId: 1,
          sex: 0,
          classId: 1,
          customizations: [{ optionId: 58, choiceId: 915 }],
          itemIds: [16820],
          equipmentOverrides: [{ itemId: 19019, equipSlot: 16 }],
          renderAssetUrl: "https://render.worldofwarcraft.com/character.png",
        },
        fetchedAt,
      });
      const loaded = await cache.latest("101");
      expect(loaded?.facts.customizations[0]?.choiceId).toBe(915);
      expect(loaded?.facts.renderAssetUrl).toContain(
        "render.worldofwarcraft.com",
      );
      const many = await cache.latestMany(["101", "missing"]);
      expect(many).toHaveLength(1);
    } finally {
      await database.close();
      await container.stop();
    }
  });
});
