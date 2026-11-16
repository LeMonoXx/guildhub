import type { GuildChronicleResponse } from "@guildhub/contracts";
import { useState } from "react";
import {
  AchievementHover,
  AchievementIcon,
  CharacterLink,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatDateTime, formatRelativeTime } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";

type TimelineEvent = GuildChronicleResponse["timeline"][number];

interface GuildTimelineProps {
  readonly timeline: GuildChronicleResponse["timeline"];
}

type Filter = "all" | "achievement" | "login";
const filters: readonly Filter[] = ["all", "achievement", "login"];
const pageSize = 12;

type Entry =
  | { readonly kind: "achievement"; readonly event: TimelineEvent }
  | { readonly kind: "login"; readonly events: readonly TimelineEvent[] };

/** Logins carry little news, so a run of them reads as one row of names. */
const toEntries = (events: readonly TimelineEvent[]): Entry[] =>
  events.reduce<Entry[]>(appendEvent, []);

const appendEvent = (entries: Entry[], event: TimelineEvent): Entry[] => {
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

const entryKey = (entry: Entry) =>
  entry.kind === "achievement"
    ? `${entry.event.slug}-achievement-${entry.event.at}-${entry.event.title}`
    : `login-${entry.events[0]?.slug ?? ""}-${entry.events[0]?.at ?? ""}`;

function Moment({ at }: { readonly at: string }) {
  const { locale } = useLocale();
  return (
    <time dateTime={at} title={formatDateTime(at, locale)}>
      {formatRelativeTime(at, locale)}
    </time>
  );
}

function Member({ event }: { readonly event: TimelineEvent }) {
  return (
    <CharacterLink
      slug={event.slug}
      classId={event.classId}
      title={`${event.name} ${event.surname}`}
    >
      {event.name}
    </CharacterLink>
  );
}

function AchievementCard({ event }: { readonly event: TimelineEvent }) {
  const { t } = useLocale();
  return (
    <div className="timeline-card timeline-achievement">
      <AchievementIcon
        className="timeline-trophy"
        iconUrl={event.iconUrl}
        fallback="✦"
      />
      <div className="timeline-achievement-body">
        <span className="eyebrow">{t("timeline.achievementEyebrow")}</span>
        <div>
          <Member event={event} /> {t("timeline.earnedShort")}{" "}
          <AchievementHover
            achievement={{
              name: event.title,
              iconUrl: event.iconUrl,
              details: event.details,
            }}
          >
            <strong className="timeline-title">{event.title}</strong>
          </AchievementHover>
        </div>
      </div>
      <Moment at={event.at} />
    </div>
  );
}

function LoginRow({ events }: { readonly events: readonly TimelineEvent[] }) {
  const { t, locale } = useLocale();
  const newest = events[0];
  if (!newest) return null;
  return (
    <div className="timeline-logins">
      <span className="timeline-logins-label">
        {events.length === 1
          ? t("timeline.loggedInOne")
          : t("timeline.loggedInMany", { count: events.length })}
      </span>
      <span className="timeline-logins-names">
        {events.map((event) => (
          <span
            key={`${event.slug}-${event.at}`}
            className="timeline-login-chip"
            title={formatDateTime(event.at, locale)}
          >
            <Member event={event} />
          </span>
        ))}
      </span>
      <Moment at={newest.at} />
    </div>
  );
}

export function GuildTimeline({ timeline }: GuildTimelineProps) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(pageSize);
  const entries = toEntries(
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
            key={entryKey(entry)}
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
              <AchievementCard event={entry.event} />
            ) : (
              <LoginRow events={entry.events} />
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
