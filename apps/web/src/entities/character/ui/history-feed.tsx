import type { HistoryEvent } from "@guildhub/contracts";
import { useState } from "react";
import { useLocale } from "../../../shared/i18n";
import { formatDate } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";
import {
  HistoryEventGroup,
  HistoryEventRow,
  LevelUpCard,
  RosterBanner,
} from "./history-event-text";

interface HistoryFeedProps {
  readonly events: readonly HistoryEvent[];
  readonly pageSize?: number;
}

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
};

type Group = [HistoryEvent, ...HistoryEvent[]];

/** Gear stays one row per piece; the rest bundles per member and kind. */
const groupRows = (events: readonly HistoryEvent[]): Group[] => {
  const groups = new Map<string, Group>();
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

/** Recorded changes, newest day first: level-ups lead each day, then the rest. */
export function HistoryFeed({ events, pageSize = 80 }: HistoryFeedProps) {
  const { t, locale } = useLocale();
  const [shown, setShown] = useState(pageSize);
  const days = new Map<string, HistoryEvent[]>();
  for (const event of events.slice(0, shown)) {
    const list = days.get(event.day) ?? [];
    list.push(event);
    days.set(event.day, list);
  }
  return (
    <div className="history-feed">
      <ol className="history-days">
        {[...days].map(([day, list], dayIndex) => {
          const levels = list.filter(
            (event): event is Extract<HistoryEvent, { kind: "level" }> =>
              event.kind === "level",
          );
          const banners = list.filter(
            (
              event,
            ): event is Extract<HistoryEvent, { kind: "joined" | "left" }> =>
              event.kind === "joined" || event.kind === "left",
          );
          const rows = groupRows(
            list
              .filter((event) => rowOrder[event.kind] > 0)
              .sort((a, b) => rowOrder[a.kind] - rowOrder[b.kind]),
          );
          return (
            <Reveal
              key={day}
              as="li"
              className="history-day"
              delayMs={Math.min(dayIndex, 6) * 60}
            >
              <time className="history-day-label" dateTime={day}>
                {formatDate(`${day}T12:00:00Z`, locale)}
              </time>
              {banners.length > 0 ? (
                <div className="history-banners">
                  {banners.map((event, index) => (
                    <RosterBanner
                      key={`${event.slug}-${String(index)}`}
                      event={event}
                    />
                  ))}
                </div>
              ) : null}
              {levels.length > 0 ? (
                <div className="history-levelups">
                  {levels.map((event, index) => (
                    <div
                      key={event.slug}
                      className="history-stagger"
                      style={{ ["--event-index" as string]: String(index) }}
                    >
                      <LevelUpCard event={event} />
                    </div>
                  ))}
                </div>
              ) : null}
              {rows.length > 0 ? (
                <ul className="history-events">
                  {rows.map((group, index) => (
                    <li
                      key={`${group[0].slug}-${group[0].kind}-${String(index)}`}
                      className="history-stagger"
                      style={{
                        ["--event-index" as string]: String(
                          levels.length + index,
                        ),
                      }}
                    >
                      {group.length === 1 ? (
                        <HistoryEventRow event={group[0]} />
                      ) : (
                        <HistoryEventGroup events={group} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Reveal>
          );
        })}
      </ol>
      {events.length > shown ? (
        <button
          type="button"
          className="timeline-more"
          onClick={() => {
            setShown((count) => count + pageSize);
          }}
        >
          {t("timeline.more", { count: events.length - shown })}
        </button>
      ) : null}
    </div>
  );
}
