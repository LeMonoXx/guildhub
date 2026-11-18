import type { AchievementDetails, HistoryEvent } from "@guildhub/contracts";

type MemberRef = Pick<
  HistoryEvent,
  "slug" | "name" | "surname" | "classId" | "avatarUrl"
>;

/** One achievement, from the history or from a member's recent list. */
export interface TimelineAchievement extends MemberRef {
  readonly title: string;
  readonly at: string;
  readonly iconUrl?: string;
  readonly details?: AchievementDetails;
}

export type TimelineEntry =
  | {
      readonly type: "event";
      readonly at: string;
      readonly event: Exclude<HistoryEvent, { kind: "achievement" }>;
    }
  | {
      readonly type: "achievement";
      readonly at: string;
      readonly achievement: TimelineAchievement;
    };

export interface TimelineDay {
  /** `YYYY-MM-DD` in the viewer's time zone. */
  readonly day: string;
  readonly entries: readonly TimelineEntry[];
}

/** A member's own list of recent achievements, as timeline achievements. */
export const listedAchievements = (
  member: MemberRef,
  recent: readonly {
    readonly name: string;
    readonly at: string;
    readonly iconUrl?: string | undefined;
    readonly details?: AchievementDetails | undefined;
  }[],
): TimelineAchievement[] =>
  recent.map((achievement) => ({
    ...member,
    title: achievement.name,
    at: achievement.at,
    iconUrl: achievement.iconUrl,
    details: achievement.details,
  }));

const fromEvent = (event: HistoryEvent): TimelineEntry =>
  event.kind === "achievement"
    ? {
        type: "achievement",
        at: event.at,
        achievement: {
          slug: event.slug,
          name: event.name,
          surname: event.surname,
          classId: event.classId,
          avatarUrl: event.avatarUrl,
          title: event.achievement,
          at: event.at,
          iconUrl: event.iconUrl,
        },
      }
    : { type: "event", at: event.at, event };

const achievementKey = (achievement: TimelineAchievement): string =>
  `${achievement.slug}|${achievement.title}|${achievement.at}`;

/**
 * A count of new achievements is only kept from before a member's first
 * listed achievement; after that, each achievement shows on its own.
 */
const withoutCountedTwice = (
  entries: readonly TimelineEntry[],
): TimelineEntry[] => {
  const firstListed = new Map<string, string>();
  for (const entry of entries) {
    if (entry.type !== "achievement") continue;
    const { slug, at } = entry.achievement;
    const known = firstListed.get(slug);
    if (known === undefined || at < known) firstListed.set(slug, at);
  }
  return entries.filter((entry) => {
    if (entry.type !== "event" || entry.event.kind !== "achievements")
      return true;
    const first = firstListed.get(entry.event.slug);
    return first === undefined || entry.at < first;
  });
};

/**
 * Every change and achievement on its own, newest first, under the day it
 * happened. Achievements both lists know show once.
 */
export function historyTimeline(
  events: readonly HistoryEvent[],
  achievements: readonly TimelineAchievement[] = [],
  timeZone?: string,
): TimelineDay[] {
  const seen = new Set<string>();
  const entries = [
    ...events.map(fromEvent),
    ...achievements.map((achievement): TimelineEntry => ({
      type: "achievement",
      at: achievement.at,
      achievement,
    })),
  ].filter((entry) => {
    if (entry.type !== "achievement") return true;
    const key = achievementKey(entry.achievement);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ordered = withoutCountedTwice(entries).sort((a, b) =>
    b.at.localeCompare(a.at),
  );
  const days: TimelineDay[] = [];
  const dayOf = dayFormatter(timeZone);
  for (const entry of ordered) {
    const day = dayOf(entry.at);
    const last = days.at(-1);
    if (last?.day === day) (last.entries as TimelineEntry[]).push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}

const dayFormatter = (timeZone?: string) => {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (at: string) => format.format(new Date(at));
};

export const timelineEntryKey = (entry: TimelineEntry): string =>
  entry.type === "achievement"
    ? `achievement|${achievementKey(entry.achievement)}`
    : JSON.stringify(entry.event);
