import type { GuildChronicleResponse } from "@guildhub/contracts";
import {
  HONORED_TIER,
  honorableKills,
  itemLevel,
  questsCompleted,
  recipeCount,
  ref,
  reputationsAtLeast,
  type ChronicleEntry,
  type MemberRef,
} from "./chronicle-entry.js";

type Response = GuildChronicleResponse;

/** Blizzard's achievement-statistics sub-category "Boss Kills". */
export const BOSS_KILLS_STATISTIC_GROUP = 14821;

/** Each profession with its crafters, most practised first. */
export function composeProfessions(
  entries: readonly ChronicleEntry[],
): Response["professions"] {
  const byName = new Map<
    string,
    (MemberRef & { skill: number; maxSkill: number })[]
  >();
  for (const entry of entries) {
    for (const profession of entry.profile.professions) {
      const crafters = byName.get(profession.name) ?? [];
      crafters.push({
        ...ref(entry),
        skill: profession.skill,
        maxSkill: profession.maxSkill,
      });
      byName.set(profession.name, crafters);
    }
  }
  return [...byName.entries()]
    .map(([name, crafters]) => ({
      name,
      crafters: crafters.sort((a, b) => b.skill - a.skill),
    }))
    .sort(
      (a, b) =>
        b.crafters.length - a.crafters.length || a.name.localeCompare(b.name),
    );
}

/** Every boss any member has killed, with the kill count and who was there. */
export function composeBestiary(
  entries: readonly ChronicleEntry[],
): Response["bestiary"] {
  const bosses = new Map<
    string,
    { boss: string; place?: string; kills: number; slayers: MemberRef[] }
  >();
  for (const entry of entries) {
    const group = entry.profile.statisticGroups.find(
      (candidate) => candidate.id === BOSS_KILLS_STATISTIC_GROUP,
    );
    for (const statistic of group?.entries ?? []) {
      if (statistic.quantity <= 0) continue;
      const { boss, place } = splitBossStatistic(statistic.name);
      const key = `${boss}|${place ?? ""}`;
      const current = bosses.get(key) ?? {
        boss,
        ...(place === undefined ? {} : { place }),
        kills: 0,
        slayers: [],
      };
      current.kills += Math.trunc(statistic.quantity);
      current.slayers.push(ref(entry));
      bosses.set(key, current);
    }
  }
  return [...bosses.values()].sort(
    (a, b) => b.kills - a.kills || a.boss.localeCompare(b.boss),
  );
}

/** "Bazzalan kills (Ragefire Chasm)" names the boss and, in parentheses, the place. */
export function splitBossStatistic(name: string): {
  boss: string;
  place?: string;
} {
  const match = /^(.*?)\s+\S+\s+\(([^)]+)\)$/.exec(name);
  if (match?.[1] === undefined || match[2] === undefined) return { boss: name };
  return { boss: match[1], place: match[2] };
}

type Category = Response["hallOfFame"][number]["category"];

const hallOfFameMeasures: readonly [
  Category,
  (entry: ChronicleEntry) => number,
][] = [
  ["level", (entry) => entry.member.level],
  ["itemLevel", (entry) => itemLevel(entry) ?? 0],
  ["quests", questsCompleted],
  ["honorableKills", honorableKills],
  ["achievements", (entry) => entry.profile.achievements.total],
  ["mounts", (entry) => entry.profile.collections.mounts.length],
  ["recipes", recipeCount],
  ["reputation", (entry) => reputationsAtLeast(entry, HONORED_TIER)],
];

/** The leader of each category. Level counts for everyone; the rest needs a published profile. */
export function composeHallOfFame(
  entries: readonly ChronicleEntry[],
): Response["hallOfFame"] {
  return hallOfFameMeasures.flatMap(([category, measure]) => {
    const best = [...entries]
      .filter((entry) => category === "level" || entry.available)
      .sort((a, b) => measure(b) - measure(a))[0];
    if (best === undefined || measure(best) <= 0) return [];
    return [{ ...ref(best), category, value: measure(best) }];
  });
}
