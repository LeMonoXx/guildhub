import type { HistoryEvent } from "@guildhub/contracts";
import { useState } from "react";
import { useLocale } from "../../../shared/i18n";
import { formatDate } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";
import { groupHistoryByDay, splitHistoryDay } from "../model/history-day";
import { HistoryEventGroup } from "./history-event-group";
import { HistoryEventRow } from "./history-event-row";
import { LevelUpCard } from "./level-up-card";
import { RosterBanner } from "./roster-banner";

interface HistoryFeedProps {
  readonly events: readonly HistoryEvent[];
  readonly pageSize?: number;
}

/** Recorded changes, newest day first: level-ups lead each day, then the rest. */
export function HistoryFeed({ events, pageSize = 80 }: HistoryFeedProps) {
  const { t, locale } = useLocale();
  const [shown, setShown] = useState(pageSize);
  const days = groupHistoryByDay(events.slice(0, shown));
  return (
    <div className="history-feed">
      <ol className="history-days">
        {[...days].map(([day, list], dayIndex) => {
          const { banners, levels, rows } = splitHistoryDay(list);
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
