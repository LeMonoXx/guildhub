import type { HistoryEvent } from "@guildhub/contracts";
import {
  legacyCheckLocale,
  type GuildCheck,
  type ListedAchievement,
} from "./guild-check.js";
import { profileChanges, ref, rosterChanges } from "./member-changes.js";

export { guildSeries, memberSeries } from "./history-series.js";

/** Every achievement any check listed, per character, each once. */
export type AchievementLog = ReadonlyMap<string, readonly ListedAchievement[]>;

export function achievementLog(checks: readonly GuildCheck[]): AchievementLog {
  const log = new Map<string, Map<number, ListedAchievement>>();
  for (const check of checks)
    for (const member of check.members) {
      const listed =
        log.get(member.characterId) ?? new Map<number, ListedAchievement>();
      for (const achievement of member.recentAchievements ?? [])
        listed.set(achievement.id, achievement);
      log.set(member.characterId, listed);
    }
  return new Map(
    [...log].map(([characterId, listed]) => [
      characterId,
      [...listed.values()],
    ]),
  );
}

const earnedBetween = (
  log: AchievementLog,
  characterId: string,
  previous: GuildCheck,
  current: GuildCheck,
): readonly ListedAchievement[] =>
  (log.get(characterId) ?? []).filter((achievement) => {
    const at = Date.parse(achievement.at);
    return (
      at > previous.recordedAt.getTime() && at <= current.recordedAt.getTime()
    );
  });

/**
 * What changed from one check to the next. The first check is the baseline
 * and produces no events: nothing is known about what came before. With a
 * `log`, each achievement shows between the checks it was earned between,
 * even when Battle.net listed it late.
 */
export function diffChecks(
  previous: GuildCheck,
  current: GuildCheck,
  log?: AchievementLog,
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
        ? profileChanges(
            earlier,
            member,
            event,
            namesComparable,
            log && earnedBetween(log, member.characterId, previous, current),
          )
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
  const log = achievementLog(checks);
  const events: HistoryEvent[] = [];
  for (let index = checks.length - 1; index > 0; index -= 1) {
    const current = checks[index];
    const previous = checks[index - 1];
    if (current !== undefined && previous !== undefined)
      events.push(...diffChecks(previous, current, log));
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
