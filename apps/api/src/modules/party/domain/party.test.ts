import type { QuestLogEntry } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { composeParty, suggestGroup, type PartyEntry } from "./party.js";

const WARRIOR = "1";
const PALADIN = "2";
const ROGUE = "4";
const PRIEST = "5";
const MAGE = "8";

function entry(
  name: string,
  level: number,
  classId: string,
  quests: QuestLogEntry[] = [],
  available = true,
): PartyEntry {
  return {
    member: {
      slug: `${name.toLowerCase()}-realm`,
      name,
      surname: "Realm",
      level,
      classId,
    },
    available,
    profile: {
      summary: {
        level,
        achievementPoints: 0,
        lastLoginAt: "2026-11-17T10:00:00.000Z",
      },
      quests: { inProgress: quests, completedCount: 0, recentCompleted: [] },
    },
  };
}

const lostInBattle: QuestLogEntry = {
  id: 4921,
  name: "Lost in Battle",
  area: "The Barrens",
  areaId: 17,
  minLevel: 17,
};
const ratStew: QuestLogEntry = {
  id: 862,
  name: "Dig Rat Stew",
  area: "The Barrens",
  areaId: 17,
  minLevel: 18,
};
const tubers: QuestLogEntry = {
  id: 1221,
  name: "Blueleaf Tubers",
  area: "Razorfen Kraul",
  areaId: 491,
  minLevel: 20,
};

describe("composeParty", () => {
  const party = composeParty({
    faction: "HORDE",
    entries: [
      entry("Twitoc", 23, WARRIOR, [lostInBattle, ratStew, tubers]),
      entry("Kala", 23, PRIEST, [lostInBattle]),
      entry("Silence", 22, ROGUE, [lostInBattle, ratStew]),
      entry("Fridolin", 24, MAGE, [tubers]),
      entry("Hidden", 21, PALADIN, [lostInBattle], false),
    ],
  });

  it("lists quests two or more members share, most shared first", () => {
    expect(party.quests.map((q) => [q.name, q.members.length])).toEqual([
      ["Lost in Battle", 3],
      ["Dig Rat Stew", 2],
      ["Blueleaf Tubers", 2],
    ]);
  });

  it("counts open quests per area and sets each member's focus", () => {
    expect(party.areas[0]).toEqual({
      area: "The Barrens",
      areaId: 17,
      members: [
        { slug: "twitoc-realm", quests: 2 },
        { slug: "silence-realm", quests: 2 },
        { slug: "kala-realm", quests: 1 },
      ],
    });
    const twitoc = party.members.find((m) => m.slug === "twitoc-realm");
    expect(twitoc?.focus).toEqual({ area: "The Barrens", areaId: 17 });
    expect(twitoc?.roles).toEqual(["tank", "damage"]);
  });

  it("keeps unpublished members for dungeons but not for quests", () => {
    expect(party.coverage).toEqual({ members: 5, profiles: 4 });
    const hidden = party.members.find((m) => m.slug === "hidden-realm");
    expect(hidden).toMatchObject({ published: false });
    expect(hidden?.focus).toBeUndefined();
    const caverns = party.dungeons.find((d) => d.key === "wailingCaverns");
    expect(caverns?.members).toContain("hidden-realm");
  });

  it("plans a full group with one tank and one healer", () => {
    const keep = party.dungeons.find((d) => d.key === "shadowfangKeep");
    expect(keep?.group).toEqual([
      { slug: "twitoc-realm", role: "tank" },
      { slug: "kala-realm", role: "healer" },
      expect.objectContaining({ role: "damage" }),
      expect.objectContaining({ role: "damage" }),
      expect.objectContaining({ role: "damage" }),
    ]);
    expect(keep?.missing).toEqual([]);
  });

  it("links dungeons to the open quests that lead inside", () => {
    const kraul = party.dungeons.find((d) => d.key === "razorfenKraul");
    expect(kraul?.quests).toEqual([1221]);
  });

  it("leaves out the other faction's dungeons", () => {
    expect(party.dungeons.map((d) => d.key)).not.toContain("deadmines");
  });
});

describe("suggestGroup", () => {
  it("keeps a lone healer healing instead of tanking", () => {
    const { group, missing } = suggestGroup([
      { slug: "paladin", roles: ["healer", "tank", "damage"], distance: 0 },
      { slug: "warrior", roles: ["tank", "damage"], distance: 1 },
    ]);
    expect(group).toEqual([
      { slug: "warrior", role: "tank" },
      { slug: "paladin", role: "healer" },
    ]);
    expect(missing).toEqual(["damage", "damage", "damage"]);
  });

  it("says which seats stay empty", () => {
    expect(
      suggestGroup([{ slug: "rogue", roles: ["damage"], distance: 0 }]).missing,
    ).toEqual(["tank", "healer", "damage", "damage"]);
  });
});
