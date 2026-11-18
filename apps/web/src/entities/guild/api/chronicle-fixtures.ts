import {
  guildChronicleResponseSchema,
  type GuildChronicleResponse,
} from "@guildhub/contracts";
import { parseContract } from "../../../shared/api";

const fetchedAt = "2026-11-13T18:00:00.000Z";
const shade = {
  slug: "shade",
  name: "Shade",
  surname: "Example",
  classId: "4",
};
const brightforge = {
  slug: "brightforge",
  name: "Brightforge",
  surname: "Example",
  classId: "2",
};

export const fixtureGuildChronicle = (): GuildChronicleResponse =>
  parseContract(guildChronicleResponseSchema, {
    createdAt: "2026-10-01T12:00:00.000Z",
    coverage: { members: 14, profiles: 2 },
    totals: {
      averageLevel: 79.6,
      maxLevel: 80,
      honorableKills: 120,
      questsCompleted: 980,
      achievements: 40,
      mounts: 6,
      pets: 9,
      recipes: 55,
      bossKills: 7,
      exaltedReputations: 1,
    },
    classes: [
      { key: "4", count: 6 },
      { key: "2", count: 1 },
    ],
    races: [
      { key: "1", count: 8 },
      { key: "7", count: 3 },
    ],
    ranks: [
      { key: "0", count: 1 },
      { key: "2", count: 6 },
    ],
    levels: [
      { from: 70, to: 79, count: 3 },
      { from: 80, to: 89, count: 11 },
    ],
    professions: [
      {
        name: "Blacksmithing",
        crafters: [{ ...brightforge, skill: 120, maxSkill: 150 }],
      },
    ],
    bestiary: [
      {
        boss: "Bazzalan",
        place: "Ragefire Chasm",
        kills: 3,
        slayers: [shade, brightforge],
      },
    ],
    hallOfFame: [
      { ...shade, category: "level", value: 80 },
      { ...brightforge, category: "quests", value: 400 },
    ],
    dossiers: [
      {
        ...shade,
        characterId: "101",
        status: "available",
        level: 80,
        averageItemLevel: 21,
        lastLoginAt: fetchedAt,
        achievementPoints: 10,
        questsCompleted: 42,
        honorableKills: 12,
        mounts: 1,
        specialization: "Assassination",
        professions: [{ name: "Blacksmithing", skill: 120, maxSkill: 150 }],
        avatarUrl: "/api/characters/shade/avatar",
      },
    ],
    fetchedAt,
    stale: false,
  });
