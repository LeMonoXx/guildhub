import { useState, type ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import { formatDate } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";
import type { HistoryEventOf } from "../model/history-event";
import {
  timelineEntryKey,
  type TimelineDay,
  type TimelineEntry,
} from "../model/history-timeline";
import { TimelineEntryCard } from "./timeline-entry-card";

interface HistoryTimelineProps {
  readonly days: readonly TimelineDay[];
  /** A member cheering beside their level-up; nothing when absent. */
  readonly renderCelebration?: (event: HistoryEventOf<"level">) => ReactNode;
  readonly pageSize?: number;
}

const kindOf = (entry: TimelineEntry): string =>
  entry.type === "achievement" ? "achievement" : entry.event.kind;

/** Every change on its own line, newest first, at the time it happened. */
export function HistoryTimeline({
  days,
  renderCelebration,
  pageSize = 60,
}: HistoryTimelineProps) {
  const { t, locale } = useLocale();
  const [shown, setShown] = useState(pageSize);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const total = days.reduce((sum, day) => sum + day.entries.length, 0);
  let budget = shown;
  const visible = days.flatMap((day) => {
    if (budget <= 0) return [];
    const entries = day.entries.slice(0, budget);
    budget -= entries.length;
    return [{ day: day.day, entries }];
  });
  return (
    <div className="history-timeline">
      <ol className="history-timeline-days">
        {visible.map((day) => (
          <li key={day.day} className="history-timeline-day">
            <time className="history-timeline-date" dateTime={day.day}>
              {formatDate(`${day.day}T12:00:00Z`, locale)}
            </time>
            <ol className="history-timeline-entries">
              {day.entries.map((entry, index) => (
                <Reveal
                  key={timelineEntryKey(entry)}
                  as="li"
                  className="history-timeline-entry"
                  delayMs={Math.min(index, 8) * 50}
                >
                  <time className="history-timeline-time" dateTime={entry.at}>
                    {time.format(new Date(entry.at))}
                  </time>
                  <span
                    className="history-timeline-node"
                    data-kind={kindOf(entry)}
                    aria-hidden="true"
                  />
                  <TimelineEntryCard
                    entry={entry}
                    renderCelebration={renderCelebration}
                  />
                </Reveal>
              ))}
            </ol>
          </li>
        ))}
      </ol>
      {total > shown ? (
        <button
          type="button"
          className="timeline-more"
          onClick={() => {
            setShown((count) => count + pageSize);
          }}
        >
          {t("timeline.more", { count: total - shown })}
        </button>
      ) : null}
    </div>
  );
}
