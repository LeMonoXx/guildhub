import type { HistoryEvent } from "@guildhub/contracts";
import { joinClimbs } from "./history-climbs";

export type LevelEvent = Extract<HistoryEvent, { kind: "level" }>;
export type RosterEvent = Extract<HistoryEvent, { kind: "joined" | "left" }>;
export type HistoryRowGroup = [HistoryEvent, ...HistoryEvent[]];

export interface HistoryDay {
  readonly banners: readonly RosterEvent[];
  readonly levels: readonly LevelEvent[];
  readonly rows: readonly HistoryRowGroup[];
}

/** Rows follow this order; 0 means the event shows as a banner or card instead. */
const rowOrder: Record<HistoryEvent["kind"], number> = {
  joined: 0,
  left: 0,
  level: 0,
  rank: 1,
  item: 2,
  achievements: 3,
  reputation: 4,
  profession: 5,
  mount: 6,
  quests: 7,
};

/** Gear stays one row per piece; the rest bundles per member and kind. */
const groupRows = (events: readonly HistoryEvent[]): HistoryRowGroup[] => {
  const groups = new Map<string, HistoryRowGroup>();
  events.forEach((event, index) => {
    const key =
      event.kind === "item" || event.kind === "achievements"
        ? String(index)
        : `${event.slug}:${event.kind}`;
    const group = groups.get(key);
    if (group) group.push(event);
    else groups.set(key, [event]);
  });
  return [...groups.values()];
};

export const groupHistoryByDay = (
  events: readonly HistoryEvent[],
): ReadonlyMap<string, readonly HistoryEvent[]> => {
  const days = new Map<string, HistoryEvent[]>();
  for (const event of events) {
    const list = days.get(event.day) ?? [];
    list.push(event);
    days.set(event.day, list);
  }
  return days;
};

export const splitHistoryDay = (day: readonly HistoryEvent[]): HistoryDay => {
  const events = joinClimbs(day);
  return {
    banners: events.filter(
      (event): event is RosterEvent =>
        event.kind === "joined" || event.kind === "left",
    ),
    levels: events.filter(
      (event): event is LevelEvent => event.kind === "level",
    ),
    rows: groupRows(
      events
        .filter((event) => rowOrder[event.kind] > 0)
        .sort((a, b) => rowOrder[a.kind] - rowOrder[b.kind]),
    ),
  };
};
