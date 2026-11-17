import type { HistoryEvent } from "@guildhub/contracts";

const climbKey = (event: HistoryEvent): string | undefined => {
  switch (event.kind) {
    case "level":
    case "quests":
      return `${event.slug}:${event.kind}`;
    case "profession":
      return `${event.slug}:profession:${event.profession}`;
    case "reputation":
      return `${event.slug}:reputation:${event.faction}`;
    default:
      return undefined;
  }
};

const joinClimb = (newer: HistoryEvent, older: HistoryEvent): HistoryEvent =>
  "from" in newer && "from" in older ? { ...newer, from: older.from } : newer;

/**
 * Hourly checks split one evening's climb into steps; a day shows each climb
 * once, from where it started to where it ended. `events` is newest first.
 */
export function joinClimbs(
  events: readonly HistoryEvent[],
): readonly HistoryEvent[] {
  const kept: HistoryEvent[] = [];
  const climbs = new Map<string, number>();
  for (const event of events) {
    const key = climbKey(event);
    const at = key === undefined ? undefined : climbs.get(key);
    const newer = at === undefined ? undefined : kept[at];
    if (at !== undefined && newer !== undefined) {
      kept[at] = joinClimb(newer, event);
      continue;
    }
    if (key !== undefined) climbs.set(key, kept.length);
    kept.push(event);
  }
  return kept;
}
