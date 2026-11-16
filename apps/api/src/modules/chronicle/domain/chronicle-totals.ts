import type { GuildChronicleResponse } from "@guildhub/contracts";
import {
  EXALTED_TIER,
  honorableKills,
  questsCompleted,
  recipeCount,
  reputationsAtLeast,
  sum,
  type ChronicleEntry,
} from "./chronicle-entry.js";

type Response = GuildChronicleResponse;

const LEVEL_BUCKET = 10;

export function composeTotals(
  entries: readonly ChronicleEntry[],
  bossKills: number,
): Response["totals"] {
  const published = entries.filter((entry) => entry.available);
  const levels = entries.map((entry) => entry.member.level);
  return {
    averageLevel:
      levels.length === 0
        ? 0
        : Math.round((sum(levels) / levels.length) * 10) / 10,
    maxLevel: maxLevel(levels),
    honorableKills: sum(published.map(honorableKills)),
    questsCompleted: sum(published.map(questsCompleted)),
    achievements: sum(published.map((e) => e.profile.achievements.total)),
    mounts: new Set(published.flatMap((e) => e.profile.collections.mounts))
      .size,
    pets: sum(published.map((e) => e.profile.collections.pets.length)),
    recipes: sum(published.map(recipeCount)),
    bossKills,
    exaltedReputations: sum(
      published.map((e) => reputationsAtLeast(e, EXALTED_TIER)),
    ),
  };
}

export function composeMakeup(
  entries: readonly ChronicleEntry[],
): Pick<Response, "classes" | "races" | "ranks" | "levels"> {
  const levels = entries.map((entry) => entry.member.level);
  return {
    classes: countBy(entries.map((entry) => entry.member.classId)),
    races: countBy(entries.map((entry) => entry.member.raceId)),
    ranks: countBy(entries.map((entry) => String(entry.member.rankId))).sort(
      (a, b) => Number(a.key) - Number(b.key),
    ),
    levels: levelBuckets(levels, maxLevel(levels)),
  };
}

function maxLevel(levels: readonly number[]): number {
  return levels.length === 0 ? 0 : Math.max(...levels);
}

function levelBuckets(levels: readonly number[], top: number) {
  const end = (Math.floor(top / LEVEL_BUCKET) + 1) * LEVEL_BUCKET;
  const buckets: Response["levels"] = [];
  for (let start = 0; start < end; start += LEVEL_BUCKET) {
    const from = Math.max(1, start);
    const to = start + LEVEL_BUCKET - 1;
    buckets.push({
      from,
      to,
      count: levels.filter((level) => level >= from && level <= to).length,
    });
  }
  return buckets;
}

function countBy(keys: readonly string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
