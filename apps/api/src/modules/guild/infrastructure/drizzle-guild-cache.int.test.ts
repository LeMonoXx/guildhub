import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../../../platform/db/client.js";
import { applyMigrations } from "../../../platform/db/migrate.js";
import { rankId } from "../domain/roster-member.js";
import { makeDrizzleGuildCache } from "./drizzle-guild-cache.js";

const guild = { slug: "example-guild" };
const fetchedAt = new Date("2026-11-13T12:00:00.000Z");

describe("drizzle guild cache", () => {
  it("stores and reads profile and roster snapshots independently", async () => {
    const container = await new PostgreSqlContainer(
      "postgres:18-alpine",
    ).start();
    const database = createMigrationDatabase(container.getConnectionUri());
    try {
      await applyMigrations(database);
      const cache = makeDrizzleGuildCache(database);

      await cache.saveProfile({
        guild,
        fetchedAt,
        payload: {
          id: "1",
          slug: "example-guild",
          name: "Example Guild",
          faction: "ALLIANCE",
          achievementPoints: 0,
          memberCount: 2,
        },
      });
      await cache.saveRoster({
        guild,
        fetchedAt,
        payload: [
          {
            characterId: "101",
            name: "Guildmaster",
            surname: "Example",
            level: 80,
            rankId: rankId(0),
            classId: "1",
            raceId: "1",
            slug: "guildmaster-example",
          },
        ],
      });

      const profile = await cache.latestProfile(guild);
      const roster = await cache.latestRoster(guild);
      expect(profile?.payload.name).toBe("Example Guild");
      expect(roster?.payload).toHaveLength(1);
      expect(roster?.payload[0]?.rankId).toBe(0);
    } finally {
      await database.close();
      await container.stop();
    }
  });
});
