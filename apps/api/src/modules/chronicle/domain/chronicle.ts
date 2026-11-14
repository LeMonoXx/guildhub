import type { GuildChronicleResponse } from "@guildhub/contracts";
import type { CharacterProfileData } from "../../character/index.js";
import type { RosterMember } from "../../guild/index.js";

export type Chronicle = Omit<GuildChronicleResponse, "fetchedAt" | "stale">;

export interface ChronicleEntry {
  readonly member: RosterMember;
  readonly available: boolean;
  readonly profile: CharacterProfileData;
}

/** Blizzard's achievement-statistics sub-category "Boss Kills". */
export const BOSS_KILLS_STATISTIC_GROUP = 14821;
/** Reputation tiers count up from Hated (0); Honored is 5, Exalted is 7. */
const HONORED_TIER = 5;
const EXALTED_TIER = 7;
const LEVEL_BUCKET = 10;
const TIMELINE_LIMIT = 40;

export function composeChronicle(input: {
  entries: readonly ChronicleEntry[];
  createdAt?: string;
}): Chronicle {
  const { entries } = input;
  const published = entries.filter((entry) => entry.available);
  const levels = entries.map((entry) => entry.member.level);
  const maxLevel = levels.length === 0 ? 0 : Math.max(...levels);
  const mounts = new Set(
    published.flatMap((entry) => entry.profile.collections.mounts),
  );
  const bestiary = composeBestiary(published);
  return {
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    coverage: { members: entries.length, profiles: published.length },
    totals: {
      averageLevel:
        levels.length === 0
          ? 0
          : Math.round((sum(levels) / levels.length) * 10) / 10,
      maxLevel,
      honorableKills: sum(published.map(honorableKills)),
      questsCompleted: sum(published.map(questsCompleted)),
      achievements: sum(published.map((e) => e.profile.achievements.total)),
      mounts: mounts.size,
      pets: sum(published.map((e) => e.profile.collections.pets.length)),
      recipes: sum(published.map(recipeCount)),
      bossKills: sum(bestiary.map((boss) => boss.kills)),
      exaltedReputations: sum(
        published.map(
          (e) =>
            e.profile.reputations.filter((rep) => rep.tier >= EXALTED_TIER)
              .length,
        ),
      ),
    },
    classes: countBy(entries.map((entry) => entry.member.classId)),
    races: countBy(entries.map((entry) => entry.member.raceId)),
    ranks: countBy(entries.map((entry) => String(entry.member.rankId))).sort(
      (a, b) => Number(a.key) - Number(b.key),
    ),
    levels: levelBuckets(levels, maxLevel),
    professions: composeProfessions(published),
    bestiary,
    timeline: composeTimeline(published),
    hallOfFame: composeHallOfFame(entries),
    dossiers: entries.map((entry) => {
      const summary = entry.profile.summary;
      const spec = [...entry.profile.specializations].sort(
        (a, b) => b.spentPoints - a.spentPoints,
      )[0];
      return {
        ...ref(entry),
        characterId: entry.member.characterId,
        status: entry.available ? "available" : "unavailable",
        level: entry.member.level,
        ...(itemLevel(entry) === undefined
          ? {}
          : { averageItemLevel: itemLevel(entry) }),
        ...(summary?.lastLoginAt === undefined
          ? {}
          : { lastLoginAt: summary.lastLoginAt }),
        achievementPoints: summary?.achievementPoints ?? 0,
        questsCompleted: questsCompleted(entry),
        honorableKills: honorableKills(entry),
        mounts: entry.profile.collections.mounts.length,
        ...(spec === undefined || spec.spentPoints === 0
          ? {}
          : { specialization: spec.name }),
        professions: entry.profile.professions.map((profession) => ({
          name: profession.name,
          skill: profession.skill,
          maxSkill: profession.maxSkill,
        })),
        ...(entry.profile.avatarUrl === undefined
          ? {}
          : { avatarUrl: entry.profile.avatarUrl }),
      };
    }),
  };
}

function composeProfessions(entries: readonly ChronicleEntry[]) {
  const byName = new Map<
    string,
    (ReturnType<typeof ref> & { skill: number; maxSkill: number })[]
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

function composeBestiary(entries: readonly ChronicleEntry[]) {
  const bosses = new Map<
    string,
    {
      boss: string;
      place?: string;
      kills: number;
      slayers: ReturnType<typeof ref>[];
    }
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

function composeTimeline(entries: readonly ChronicleEntry[]) {
  const events: Chronicle["timeline"] = [];
  for (const entry of entries) {
    for (const achievement of entry.profile.achievements.recent) {
      events.push({
        ...ref(entry),
        kind: "achievement",
        title: achievement.name,
        at: achievement.at,
        ...(achievement.iconUrl === undefined
          ? {}
          : { iconUrl: achievement.iconUrl }),
        ...(achievement.details === undefined
          ? {}
          : { details: achievement.details }),
      });
    }
    const login = entry.profile.summary?.lastLoginAt;
    if (login !== undefined) {
      events.push({
        ...ref(entry),
        kind: "login",
        title: entry.member.name,
        at: login,
      });
    }
  }
  return events
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, TIMELINE_LIMIT);
}

function composeHallOfFame(entries: readonly ChronicleEntry[]) {
  const categories: [
    Chronicle["hallOfFame"][number]["category"],
    (entry: ChronicleEntry) => number,
  ][] = [
    ["level", (entry) => entry.member.level],
    ["itemLevel", (entry) => itemLevel(entry) ?? 0],
    ["quests", questsCompleted],
    ["honorableKills", honorableKills],
    ["achievements", (entry) => entry.profile.achievements.total],
    ["mounts", (entry) => entry.profile.collections.mounts.length],
    ["recipes", recipeCount],
    [
      "reputation",
      (entry) =>
        entry.profile.reputations.filter((rep) => rep.tier >= HONORED_TIER)
          .length,
    ],
  ];
  return categories.flatMap(([category, measure]) => {
    const best = [...entries]
      .filter((entry) => category === "level" || entry.available)
      .sort((a, b) => measure(b) - measure(a))[0];
    if (best === undefined || measure(best) <= 0) return [];
    return [{ ...ref(best), category, value: measure(best) }];
  });
}

function levelBuckets(levels: readonly number[], maxLevel: number) {
  const top = (Math.floor(maxLevel / LEVEL_BUCKET) + 1) * LEVEL_BUCKET;
  const buckets: Chronicle["levels"] = [];
  for (let start = 0; start < top; start += LEVEL_BUCKET) {
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

function ref(entry: ChronicleEntry) {
  return {
    slug: entry.member.slug,
    name: entry.member.name,
    surname: entry.member.surname,
    classId: entry.member.classId,
  };
}

function itemLevel(entry: ChronicleEntry): number | undefined {
  const summary = entry.profile.summary;
  return summary?.equippedItemLevel ?? summary?.averageItemLevel;
}

function questsCompleted(entry: ChronicleEntry): number {
  return entry.profile.quests.completedCount;
}

function honorableKills(entry: ChronicleEntry): number {
  return entry.profile.pvp?.honorableKills ?? 0;
}

function recipeCount(entry: ChronicleEntry): number {
  return sum(entry.profile.professions.map((p) => p.recipes.length));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
