import { describe, expect, it } from "vitest";
import {
  characterDetailResponseSchema,
  featuredMembersResponseSchema,
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
            slug: "guildmaster-example",
          },
        ],
        fetchedAt: "2026-11-13T12:00:00.000Z",
        stale: true,
      }).members,
    ).toHaveLength(1);
  });
});

const presentation = {
  slug: "shade",
  pose: "Stand",
  accent: "class-4",
  lookManifest: "/assets/looks/fixed/look.json",
};

const model = {
  status: "ready" as const,
  lookHash: "fixed",
  clientBuild: "1.60.1.70938",
  manifestUrl: "/assets/looks/fixed/look.json",
  renderUrl: "/api/characters/shade/render",
};

describe("character presentation contracts", () => {
  it("accepts featured members that share a look and keep distinct slugs", () => {
    expect(
      featuredMembersResponseSchema.parse({
        members: [
          {
            characterId: "101",
            name: "Shade",
            surname: "Example",
            level: 80,
            rankId: 0,
            classId: "4",
            raceId: "1",
            ...presentation,
          },
        ],
        fetchedAt: "2026-11-13T12:00:00.000Z",
        stale: false,
      }).members,
    ).toHaveLength(1);
  });

  it("accepts a character detail payload", () => {
    expect(
      characterDetailResponseSchema.parse({
        characterId: "101",
        name: "Shade",
        surname: "Example",
        level: 80,
        rankId: 0,
        classId: "4",
        raceId: "1",
        fetchedAt: "2026-11-13T12:00:00.000Z",
        stale: false,
        published: true,
        ...presentation,
        model,
      }).slug,
    ).toBe("shade");
  });

  it("accepts pending model status without a manifest", () => {
    expect(
      characterDetailResponseSchema.parse({
        characterId: "101",
        name: "Shade",
        surname: "Example",
        level: 80,
        rankId: 0,
        classId: "4",
        raceId: "1",
        fetchedAt: "2026-11-13T12:00:00.000Z",
        stale: false,
        published: true,
        ...presentation,
        model: {
          status: "pending",
          lookHash: "abc123",
          clientBuild: "1.60.1.70938",
        },
      }).model.status,
    ).toBe("pending");
  });

  it("rejects an uppercase character slug", () => {
    const result = characterDetailResponseSchema.safeParse({
      characterId: "101",
      name: "Shade",
      surname: "Example",
      level: 80,
      rankId: 0,
      classId: "4",
      raceId: "1",
      fetchedAt: "2026-11-13T12:00:00.000Z",
      stale: false,
      published: true,
      ...presentation,
      model,
      slug: "Shade",
    });
    expect(result.success).toBe(false);
  });
});
