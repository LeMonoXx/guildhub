import type { HistoryEvent } from "@guildhub/contracts";
import { legacyCheckLocale, type GuildCheck } from "./guild-check.js";
import { profileChanges, ref, rosterChanges } from "./member-changes.js";

export { guildSeries, memberSeries } from "./history-series.js";

/**
 * What changed from one check to the next. The first check is the baseline
 * and produces no events: nothing is known about what came before.
 */
export function diffChecks(
  previous: GuildCheck,
  current: GuildCheck,
): HistoryEvent[] {
  const before = new Map(previous.members.map((m) => [m.characterId, m]));
  const after = new Map(current.members.map((m) => [m.characterId, m]));
  const namesComparable = sameLocale(previous, current);
  const base = { day: current.day, at: current.recordedAt.toISOString() };
  const changed = current.members.flatMap((member): HistoryEvent[] => {
    const earlier = before.get(member.characterId);
    const event = { ...ref(member), ...base };
    if (earlier === undefined) return [{ ...event, kind: "joined" }];
    return [
      ...rosterChanges(earlier, member, event),
      ...(member.published && earlier.published
        ? profileChanges(earlier, member, event, namesComparable)
        : []),
    ];
  });
  const left = previous.members
    .filter((member) => !after.has(member.characterId))
    .map((member): HistoryEvent => ({ ...ref(member), ...base, kind: "left" }));
  return [...changed, ...left];
}

function sameLocale(previous: GuildCheck, current: GuildCheck): boolean {
  return (
    (previous.locale ?? legacyCheckLocale) ===
    (current.locale ?? legacyCheckLocale)
  );
}

/** Every event across `checks` (oldest first), newest first. */
export function eventsOf(checks: readonly GuildCheck[]): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (let index = checks.length - 1; index > 0; index -= 1) {
    const current = checks[index];
    const previous = checks[index - 1];
    if (current !== undefined && previous !== undefined)
      events.push(...diffChecks(previous, current));
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
