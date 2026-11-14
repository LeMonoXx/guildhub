import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../../character/domain/profile.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import {
  BOSS_KILLS_STATISTIC_GROUP,
  composeChronicle,
  splitBossStatistic,
  type ChronicleEntry,
} from "./chronicle.js";

function entry(
  name: string,
  level: number,
  overrides: Partial<ChronicleEntry["profile"]> = {},
  available = true,
): ChronicleEntry {
  const member: RosterMember = {
    characterId: name,
    name,
    surname: "Example",
    level,
    rankId: rankId(1),
    classId: level > 20 ? "1" : "4",
    raceId: "2",
    slug: `${name.toLowerCase()}-example`,
  };
  return {
    member,
    available,
    profile: { ...emptyProfileData(level), ...overrides },
  };
}

describe("composeChronicle", () => {
  it("aggregates the guild from every published profile", () => {
    const chronicle = composeChronicle({
      createdAt: "2026-11-01T00:00:00.000Z",
      entries: [
        entry("Ann", 25, {
          professions: [
            {
              id: 186,
              name: "Mining",
              kind: "primary",
              skill: 120,
              maxSkill: 150,
              recipes: ["Smelt Tin", "Smelt Copper"],
            },
          ],
          statisticGroups: [
            {
              id: BOSS_KILLS_STATISTIC_GROUP,
              name: "Boss Kills",
              entries: [
                { name: "Bazzalan kills (Ragefire Chasm)", quantity: 2 },
              ],
            },
          ],
          achievements: {
            total: 1,
            points: 10,
            recent: [
              {
                id: 1,
                name: "Explore",
                at: "2026-11-10T00:00:00.000Z",
                iconUrl: "/api/icons/136240",
              },
            ],
            categories: [],
            inProgress: [],
          },
          collections: { mounts: ["Wolf"], pets: [], toys: [], heirlooms: [] },
        }),
        entry("Bo", 12, {
          professions: [
            {
              id: 186,
              name: "Mining",
              kind: "primary",
              skill: 140,
              maxSkill: 150,
              recipes: [],
            },
          ],
          collections: { mounts: ["Wolf"], pets: [], toys: [], heirlooms: [] },
        }),
        entry("Cy", 30, {}, false),
      ],
    });
    expect(chronicle.coverage).toEqual({ members: 3, profiles: 2 });
    expect(chronicle.totals).toMatchObject({
      maxLevel: 30,
      averageLevel: 22.3,
      mounts: 1,
      recipes: 2,
      bossKills: 2,
      achievements: 1,
    });
    expect(chronicle.professions[0]?.crafters.map((c) => c.name)).toEqual([
      "Bo",
      "Ann",
    ]);
    expect(chronicle.bestiary).toEqual([
      {
        boss: "Bazzalan",
        place: "Ragefire Chasm",
        kills: 2,
        slayers: [
          {
            slug: "ann-example",
            name: "Ann",
            surname: "Example",
            classId: "1",
          },
        ],
      },
    ]);
    expect(chronicle.timeline[0]).toMatchObject({
      kind: "achievement",
      title: "Explore",
      name: "Ann",
      iconUrl: "/api/icons/136240",
    });
    expect(
      chronicle.hallOfFame.find((fame) => fame.category === "level"),
    ).toMatchObject({ name: "Cy", value: 30 });
    expect(chronicle.levels.map((bucket) => bucket.count)).toEqual([
      0, 1, 1, 1,
    ]);
    expect(chronicle.dossiers.map((d) => d.status)).toEqual([
      "available",
      "available",
      "unavailable",
    ]);
  });
});

describe("splitBossStatistic", () => {
  it("separates boss and place", () => {
    expect(
      splitBossStatistic("Mutanus the Devourer kills (Wailing Caverns)"),
    ).toEqual({ boss: "Mutanus the Devourer", place: "Wailing Caverns" });
  });

  it("keeps names without a place", () => {
    expect(splitBossStatistic("Times camped")).toEqual({
      boss: "Times camped",
    });
  });
});
