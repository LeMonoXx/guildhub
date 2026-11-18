import type { HistoryEvent } from "@guildhub/contracts";
import type { ReactNode } from "react";
import type { HistoryEventOf } from "../model/history-event";
import type { TimelineEntry } from "../model/history-timeline";
import { HistoryEventRow } from "./history-event-row";
import { RosterBanner } from "./roster-banner";
import { TimelineAchievementCard } from "./timeline-achievement-card";
import { TimelineLevelUp } from "./timeline-level-up";

type RenderCelebration = (event: HistoryEventOf<"level">) => ReactNode;
type TimelineEvent = Extract<TimelineEntry, { type: "event" }>["event"];

type EventCards = {
  readonly [K in TimelineEvent["kind"]]?: (
    event: HistoryEventOf<K>,
    renderCelebration: RenderCelebration | undefined,
  ) => ReactNode;
};

const eventCards: EventCards = {
  level: (event, renderCelebration) => (
    <TimelineLevelUp event={event} celebration={renderCelebration?.(event)} />
  ),
  joined: (event) => <RosterBanner event={event} />,
  left: (event) => <RosterBanner event={event} />,
};

function EventCard({
  event,
  renderCelebration,
}: {
  readonly event: TimelineEvent;
  readonly renderCelebration: RenderCelebration | undefined;
}) {
  const card = eventCards[event.kind] as
    | ((
        event: HistoryEvent,
        render: RenderCelebration | undefined,
      ) => ReactNode)
    | undefined;
  return card === undefined ? (
    <div className="history-timeline-card">
      <HistoryEventRow event={event} />
    </div>
  ) : (
    card(event, renderCelebration)
  );
}

export function TimelineEntryCard({
  entry,
  renderCelebration,
}: {
  readonly entry: TimelineEntry;
  readonly renderCelebration: RenderCelebration | undefined;
}) {
  return entry.type === "achievement" ? (
    <TimelineAchievementCard achievement={entry.achievement} />
  ) : (
    <EventCard event={entry.event} renderCelebration={renderCelebration} />
  );
}
