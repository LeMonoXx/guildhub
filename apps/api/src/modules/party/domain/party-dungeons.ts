import type {
  GuildFaction,
  PartyDungeon,
  PartyRole,
} from "@guildhub/contracts";
import { rolesOf } from "./class-roles.js";
import { DUNGEONS, fitsLevel, reachableBy, type Dungeon } from "./dungeons.js";
import type { PartyEntry } from "./party-entry.js";

const GROUP_SIZE = 5;

interface Candidate {
  readonly slug: string;
  readonly roles: readonly PartyRole[];
  /** Levels away from the middle of the bracket. */
  readonly distance: number;
}

type Seat = PartyDungeon["group"][number];

/** How well a member fills a seat: anyone beats nobody, their usual role and level beat the rest. */
const fit = (candidate: Candidate | undefined, role: PartyRole): number =>
  candidate === undefined
    ? 0
    : 100 + (candidate.roles[0] === role ? 10 : 0) - candidate.distance;

const able = (candidates: readonly Candidate[], role: PartyRole) => [
  undefined,
  ...candidates.filter((candidate) => candidate.roles.includes(role)),
];

/**
 * Picks the tank and healer pair that fits best, then fills the damage seats
 * with whoever is closest to the dungeon's level.
 */
export function suggestGroup(candidates: readonly Candidate[]): {
  group: Seat[];
  missing: PartyRole[];
} {
  let best = {
    score: -1,
    tank: undefined as Candidate | undefined,
    healer: undefined as Candidate | undefined,
  };
  for (const tank of able(candidates, "tank"))
    for (const healer of able(candidates, "healer")) {
      if (tank !== undefined && tank.slug === healer?.slug) continue;
      const score = fit(tank, "tank") + fit(healer, "healer");
      if (score > best.score) best = { score, tank, healer };
    }
  const leads: Seat[] = [
    ...(best.tank ? [{ slug: best.tank.slug, role: "tank" as const }] : []),
    ...(best.healer
      ? [{ slug: best.healer.slug, role: "healer" as const }]
      : []),
  ];
  const taken = new Set(leads.map((seat) => seat.slug));
  const damage = candidates
    .filter((candidate) => !taken.has(candidate.slug))
    .slice(0, GROUP_SIZE - 2)
    .map((candidate) => ({ slug: candidate.slug, role: "damage" as const }));
  const missing: PartyRole[] = [
    ...(best.tank ? [] : ["tank" as const]),
    ...(best.healer ? [] : ["healer" as const]),
    ...Array.from(
      { length: GROUP_SIZE - 2 - damage.length },
      () => "damage" as const,
    ),
  ];
  return { group: [...leads, ...damage], missing };
}

function candidatesFor(
  dungeon: Dungeon,
  entries: readonly PartyEntry[],
): Candidate[] {
  const middle = (dungeon.minLevel + dungeon.maxLevel) / 2;
  return entries
    .filter((entry) => fitsLevel(dungeon, entry.member.level))
    .map((entry) => ({
      slug: entry.member.slug,
      roles: rolesOf(entry.member.classId),
      distance: Math.abs(entry.member.level - middle),
    }))
    .sort((a, b) => a.distance - b.distance || a.slug.localeCompare(b.slug));
}

/**
 * Dungeons someone in the guild can run now or has a quest for.
 * `questsByArea` lists the open quest ids in each area.
 */
export function plannedDungeons(
  entries: readonly PartyEntry[],
  faction: GuildFaction | undefined,
  questsByArea: ReadonlyMap<number, readonly number[]>,
): PartyDungeon[] {
  return DUNGEONS.filter((dungeon) => reachableBy(dungeon, faction)).flatMap(
    (dungeon) => {
      const candidates = candidatesFor(dungeon, entries);
      const quests = [
        ...new Set(
          dungeon.areaIds.flatMap((areaId) => questsByArea.get(areaId) ?? []),
        ),
      ];
      if (candidates.length === 0 && quests.length === 0) return [];
      return [
        {
          key: dungeon.key,
          minLevel: dungeon.minLevel,
          maxLevel: dungeon.maxLevel,
          entrance: dungeon.entrance,
          areaIds: [...dungeon.areaIds],
          members: candidates.map((candidate) => candidate.slug),
          ...suggestGroup(candidates),
          quests,
        },
      ];
    },
  );
}
