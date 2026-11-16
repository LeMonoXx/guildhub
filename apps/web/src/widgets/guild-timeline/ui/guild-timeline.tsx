import type { GuildChronicleResponse } from "@guildhub/contracts";
import { useState } from "react";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";
import { timelineEntryKey, toTimelineEntries } from "../model/timeline-entries";
import { TimelineAchievementCard } from "./timeline-achievement-card";
import { TimelineLoginRow } from "./timeline-login-row";

interface GuildTimelineProps {
  readonly timeline: GuildChronicleResponse["timeline"];
}

type Filter = "all" | "achievement" | "login";
const filters: readonly Filter[] = ["all", "achievement", "login"];
const pageSize = 12;

export function GuildTimeline({ timeline }: GuildTimelineProps) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(pageSize);
  const entries = toTimelineEntries(
    timeline.filter((event) => filter === "all" || event.kind === filter),
  );
  if (timeline.length === 0) {
    return <p className="muted">{t("timeline.empty")}</p>;
  }
  return (
    <div className="timeline">
      <div className="segmented" role="group" aria-label={t("timeline.filter")}>
        {filters.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => {
              setFilter(option);
              setShown(pageSize);
            }}
          >
            {t(`timeline.${option}`)}
          </button>
        ))}
      </div>
      <ol className="timeline-list">
        {entries.slice(0, shown).map((entry, index) => (
          <Reveal
            key={timelineEntryKey(entry)}
            as="li"
            className={`timeline-event timeline-event-${entry.kind}`}
            delayMs={(index % pageSize) * 40}
          >
            <span
              className="timeline-node"
              data-kind={entry.kind}
              aria-hidden="true"
            />
            {entry.kind === "achievement" ? (
              <TimelineAchievementCard event={entry.event} />
            ) : (
              <TimelineLoginRow events={entry.events} />
            )}
          </Reveal>
        ))}
      </ol>
      {entries.length > shown ? (
        <button
          type="button"
          className="timeline-more"
          onClick={() => {
            setShown((count) => count + pageSize);
          }}
        >
          {t("timeline.more", { count: entries.length - shown })}
        </button>
      ) : null}
    </div>
  );
}
