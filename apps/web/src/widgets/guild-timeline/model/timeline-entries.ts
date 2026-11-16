import type { GuildChronicleResponse } from "@guildhub/contracts";

export type TimelineEvent = GuildChronicleResponse["timeline"][number];

export type TimelineEntry =
  | { readonly kind: "achievement"; readonly event: TimelineEvent }
  | { readonly kind: "login"; readonly events: readonly TimelineEvent[] };

const appendEvent = (
  entries: TimelineEntry[],
  event: TimelineEvent,
): TimelineEntry[] => {
  if (event.kind !== "login")
    return [...entries, { kind: "achievement", event }];
  const last = entries.at(-1);
  if (last?.kind !== "login")
    return [...entries, { kind: "login", events: [event] }];
  return [
    ...entries.slice(0, -1),
    { kind: "login", events: [...last.events, event] },
  ];
};

/** Logins carry little news, so a run of them reads as one row of names. */
export const toTimelineEntries = (
  events: readonly TimelineEvent[],
): TimelineEntry[] => events.reduce<TimelineEntry[]>(appendEvent, []);

export const timelineEntryKey = (entry: TimelineEntry): string =>
  entry.kind === "achievement"
    ? `${entry.event.slug}-achievement-${entry.event.at}-${entry.event.title}`
    : `login-${entry.events[0]?.slug ?? ""}-${entry.events[0]?.at ?? ""}`;
