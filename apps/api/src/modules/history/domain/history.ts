import type { HistoryEvent } from "@guildhub/contracts";
import { legacyDayLocale, type GuildDay } from "./guild-day.js";
import { profileChanges, ref, rosterChanges } from "./member-changes.js";

export { guildSeries, memberSeries } from "./history-series.js";

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
  const namesComparable = sameLocale(previous, current);
  const changed = current.members.flatMap((member): HistoryEvent[] => {
    const earlier = before.get(member.characterId);
    const base = { ...ref(member), day: current.day };
    if (earlier === undefined) return [{ ...base, kind: "joined" }];
    return [
      ...rosterChanges(earlier, member, base),
      ...(member.published && earlier.published
        ? profileChanges(earlier, member, base, namesComparable)
        : []),
    ];
  });
  const left = previous.members
    .filter((member) => !after.has(member.characterId))
    .map((member): HistoryEvent => ({
      ...ref(member),
      day: current.day,
      kind: "left",
    }));
  return [...changed, ...left];
}

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
