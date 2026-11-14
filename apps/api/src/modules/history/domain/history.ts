import type {
  CharacterHistoryPoint,
  GuildHistoryPoint,
  HistoryEvent,
} from "@guildhub/contracts";
import { legacyDayLocale, type GuildDay, type MemberDay } from "./guild-day.js";

/** Shirts and tabards change looks, not power; they are not worth a headline. */
const COSMETIC_SLOTS: ReadonlySet<string> = new Set(["SHIRT", "TABARD"]);

/**
 * What changed from one recorded day to the next. The first recorded day is
 * the baseline and produces no events: nothing is known about what came before.
 */
export function diffDays(
  previous: GuildDay,
  current: GuildDay,
): HistoryEvent[] {
  const before = new Map(previous.members.map((m) => [m.characterId, m]));
  const after = new Map(current.members.map((m) => [m.characterId, m]));
  const events: HistoryEvent[] = [];
  for (const member of current.members) {
    const earlier = before.get(member.characterId);
    const base = { ...ref(member), day: current.day };
    if (earlier === undefined) {
      events.push({ ...base, kind: "joined" });
      continue;
    }
    if (member.level > earlier.level)
      events.push({
        ...base,
        kind: "level",
        from: earlier.level,
        to: member.level,
      });
    if (member.rankId !== earlier.rankId)
      events.push({
        ...base,
        kind: "rank",
        from: earlier.rankId,
        to: member.rankId,
      });
    if (member.published && earlier.published)
      events.push(
        ...profileChanges(earlier, member, base, sameLocale(previous, current)),
      );
  }
  for (const member of previous.members) {
    if (!after.has(member.characterId))
      events.push({ ...ref(member), day: current.day, kind: "left" });
  }
  return events;
}

function profileChanges(
  earlier: MemberDay,
  member: MemberDay,
  base: ReturnType<typeof ref> & { day: string },
  namesComparable: boolean,
): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  const named = namesComparable ? member : { professions: [], mounts: [] };
  const worn = new Map(
    earlier.equipment.map((item) => [item.slot, item.itemId]),
  );
  for (const item of member.equipment) {
    if (COSMETIC_SLOTS.has(item.slot) || worn.get(item.slot) === item.itemId)
      continue;
    events.push({
      ...base,
      kind: "item",
      slot: item.slot,
      itemId: item.itemId,
      item: item.name,
      quality: item.quality,
      ...(item.itemLevel === undefined ? {} : { itemLevel: item.itemLevel }),
      ...(item.iconUrl === undefined ? {} : { iconUrl: item.iconUrl }),
    });
  }
  const skills = new Map(earlier.professions.map((p) => [p.name, p.skill]));
  for (const profession of named.professions) {
    const from = skills.get(profession.name) ?? 0;
    if (profession.skill > from)
      events.push({
        ...base,
        kind: "profession",
        profession: profession.name,
        from,
        to: profession.skill,
        ...(profession.maxSkill === undefined
          ? {}
          : { maxSkill: profession.maxSkill }),
      });
  }
  const tiers = new Map(earlier.reputations.map((r) => [r.factionId, r.tier]));
  for (const reputation of member.reputations) {
    const from = tiers.get(reputation.factionId);
    if (from !== undefined && reputation.tier > from)
      events.push({
        ...base,
        kind: "reputation",
        faction: reputation.faction,
        standing: reputation.standing,
        tier: reputation.tier,
      });
  }
  const gained = member.achievements - earlier.achievements;
  if (gained > 0)
    events.push({
      ...base,
      kind: "achievements",
      count: gained,
      points: Math.max(0, member.achievementPoints - earlier.achievementPoints),
    });
  const mounts = new Set(earlier.mounts);
  for (const mount of named.mounts) {
    if (!mounts.has(mount)) events.push({ ...base, kind: "mount", mount });
  }
  return events;
}

/** Professions and mounts are compared by name, which differs between languages. */
function sameLocale(previous: GuildDay, current: GuildDay): boolean {
  return (
    (previous.locale ?? legacyDayLocale) === (current.locale ?? legacyDayLocale)
  );
}

/** Every event across `days` (oldest first), newest day first. */
export function eventsOf(days: readonly GuildDay[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (let index = days.length - 1; index > 0; index -= 1) {
    const current = days[index];
    const previous = days[index - 1];
    if (current !== undefined && previous !== undefined)
      events.push(...diffDays(previous, current));
  }
  return events;
}

export function guildSeries(days: readonly GuildDay[]): GuildHistoryPoint[] {
  return days.map((day) => {
    const itemLevels = day.members.flatMap((m) =>
      m.itemLevel === undefined ? [] : [m.itemLevel],
    );
    return {
      day: day.day,
      members: day.members.length,
      averageLevel: round(average(day.members.map((m) => m.level)) ?? 0),
      ...(itemLevels.length === 0
        ? {}
        : { averageItemLevel: round(average(itemLevels) ?? 0) }),
      achievements: day.members.reduce(
        (total, member) => total + member.achievements,
        0,
      ),
    };
  });
}

export function memberSeries(
  days: readonly GuildDay[],
  characterId: string,
): CharacterHistoryPoint[] {
  return days.flatMap((day) => {
    const member = day.members.find((m) => m.characterId === characterId);
    if (member === undefined) return [];
    return [
      {
        day: day.day,
        level: member.level,
        ...(member.itemLevel === undefined
          ? {}
          : { itemLevel: member.itemLevel }),
        achievements: member.achievements,
      },
    ];
  });
}

function ref(member: MemberDay) {
  return {
    slug: member.slug,
    name: member.name,
    surname: member.surname,
    classId: member.classId,
  };
}

function average(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
