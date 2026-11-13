import { describe, expect, it } from "vitest";
import {
  guildProfileResponseSchema,
  guildRosterResponseSchema,
} from "./guild.js";

describe("guild contracts", () => {
  it("accepts a guild profile response", () => {
    expect(
      guildProfileResponseSchema.parse({
        id: "1",
        slug: "example-guild",
        name: "Example Guild",
        faction: "ALLIANCE",
        achievementPoints: 0,
        memberCount: 2,
        fetchedAt: "2026-11-13T12:00:00.000Z",
        stale: false,
      }),
    ).toMatchObject({ slug: "example-guild", stale: false });
  });

  it("accepts a guild roster response", () => {
    expect(
      guildRosterResponseSchema.parse({
        members: [
          {
            characterId: "101",
            name: "Guildmaster",
            surname: "Example",
            level: 80,
            rankId: 0,
            classId: "1",
            raceId: "1",
          },
        ],
        fetchedAt: "2026-11-13T12:00:00.000Z",
        stale: true,
      }).members,
    ).toHaveLength(1);
  });
});
