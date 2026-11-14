import type { HistoryEvent } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { FallbackImage } from "../../../shared/ui";
import { wowClassColorVar } from "../model/class-color";
import { itemQualityColorVar } from "../model/item";
import { reputationColorVar } from "../model/vitals";
import { CharacterLink } from "./character-link";
import { ItemIcon } from "./item-icon";

type Of<K extends HistoryEvent["kind"]> = Extract<HistoryEvent, { kind: K }>;

const glyphs: Record<HistoryEvent["kind"], string> = {
  joined: "✦",
  left: "✧",
  level: "▲",
  rank: "♛",
  item: "⚔",
  profession: "⚒",
  reputation: "❖",
  achievements: "★",
  mount: "♞",
};

function Name({ event }: { readonly event: HistoryEvent }) {
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

function Portrait({ event }: { readonly event: HistoryEvent }) {
  return (
    <span className="history-portrait" aria-hidden="true">
      <FallbackImage
        src={event.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        fallback={
          <span className="history-portrait-glyph">{glyphs[event.kind]}</span>
        }
      />
    </span>
  );
}

/** A level-up is the headline of its day: portrait, the new level, the climb. */
export function LevelUpCard({ event }: { readonly event: Of<"level"> }) {
  const { t } = useLocale();
  const gained = event.to - event.from;
  return (
    <article
      className="history-levelup"
      style={{ ["--member-class" as string]: wowClassColorVar(event.classId) }}
    >
      <span className="history-levelup-rays" aria-hidden="true" />
      <Portrait event={event} />
      <div className="history-levelup-body">
        <span className="history-levelup-label">{t("history.levelUp")}</span>
        <Name event={event} />
        <span className="history-levelup-climb">
          {event.surname} · {t("history.levelFrom", { from: event.from })}
          {gained > 1 ? ` · +${String(gained)}` : null}
        </span>
      </div>
      <strong
        className="history-levelup-level"
        aria-label={t("history.event.level", { level: event.to })}
      >
        {event.to}
      </strong>
    </article>
  );
}

/** Someone came or went; it reads as a banner across the day. */
export function RosterBanner({
  event,
}: {
  readonly event: Of<"joined" | "left">;
}) {
  const { t } = useLocale();
  return (
    <p className="history-banner" data-kind={event.kind}>
      <span className="history-banner-glyph" aria-hidden="true">
        {glyphs[event.kind]}
      </span>
      <span>
        <Name event={event} /> {t(`history.event.${event.kind}`)}
      </span>
    </p>
  );
}

function Detail({ event }: { readonly event: HistoryEvent }) {
  const { t, locale } = useLocale();
  switch (event.kind) {
    case "item":
      return (
        <>
          <span>{t("history.event.item")} </span>
          <span
            className="history-item"
            style={{ color: itemQualityColorVar(event.quality) }}
          >
            [{event.item}]
          </span>
          <span className="history-chips">
            <span className="history-chip">{t(`slot.${event.slot}`)}</span>
            {event.itemLevel === undefined || event.itemLevel <= 1 ? null : (
              <span className="history-chip">
                {t("history.itemLevel", { level: event.itemLevel })}
              </span>
            )}
          </span>
        </>
      );
    case "profession": {
      const max = event.maxSkill ?? 0;
      return (
        <>
          {t("history.event.profession", {
            profession: event.profession,
            skill: event.to,
          })}
          <span className="history-chip history-chip-gain">
            +{event.to - event.from}
          </span>
          {max > 0 ? (
            <span className="history-skill" aria-hidden="true">
              <span
                className="history-skill-before"
                style={{ width: `${String((event.from / max) * 100)}%` }}
              />
              <span
                className="history-skill-gain"
                style={{
                  left: `${String((event.from / max) * 100)}%`,
                  width: `${String(((event.to - event.from) / max) * 100)}%`,
                }}
              />
            </span>
          ) : null}
        </>
      );
    }
    case "reputation":
      return (
        <>
          {t("history.event.reputationBefore", { faction: event.faction })}{" "}
          <span
            className="history-standing"
            style={{ ["--standing" as string]: reputationColorVar(event.tier) }}
          >
            {event.standing}
          </span>{" "}
          {t("history.event.reputationAfter", { faction: event.faction })}
        </>
      );
    case "achievements":
      return (
        <>
          {t(
            event.points > 0
              ? "history.event.achievements"
              : event.count === 1
                ? "history.event.achievementOne"
                : "history.event.achievementsCount",
            {
              count: formatNumber(event.count, locale),
              points: formatNumber(event.points, locale),
            },
          )}
        </>
      );
    case "rank":
      return (
        <>{t("history.event.rank", { rank: t(`rank.${String(event.to)}`) })}</>
      );
    case "mount":
      return (
        <>
          {t("history.event.mountShort")}{" "}
          <span className="history-mount">{event.mount}</span>
        </>
      );
    case "level":
      return <>{t("history.event.level", { level: event.to })}</>;
    case "joined":
    case "left":
      return <>{t(`history.event.${event.kind}`)}</>;
  }
}

function Badge({ event }: { readonly event: HistoryEvent }) {
  if (event.kind === "item" && event.iconUrl !== undefined)
    return (
      <ItemIcon
        iconUrl={event.iconUrl}
        quality={event.quality}
        size="sm"
        label={event.item}
      />
    );
  return (
    <span
      className="history-glyph"
      aria-hidden="true"
      style={
        event.kind === "item"
          ? { ["--event-color" as string]: itemQualityColorVar(event.quality) }
          : undefined
      }
    >
      {glyphs[event.kind]}
    </span>
  );
}

/** Everything else: a typed row whose badge says at a glance what happened. */
export function HistoryEventRow({ event }: { readonly event: HistoryEvent }) {
  return (
    <div className="history-row" data-kind={event.kind}>
      <Badge event={event} />
      <p className="history-event-text">
        <Name event={event} /> <Detail event={event} />
      </p>
    </div>
  );
}

/** Several changes of one kind for one member, under one badge. */
export function HistoryEventGroup({
  events,
}: {
  readonly events: readonly [HistoryEvent, ...HistoryEvent[]];
}) {
  const { t } = useLocale();
  const [first] = events;
  return (
    <div className="history-row history-group" data-kind={first.kind}>
      <span className="history-glyph" aria-hidden="true">
        {glyphs[first.kind]}
        <span className="history-glyph-count">{events.length}</span>
      </span>
      <div className="history-event-text">
        <p>
          <Name event={first} />{" "}
          {t(`history.group.${first.kind}`, { count: events.length })}
        </p>
        <ul className="history-group-list">
          {events.map((event, index) => (
            <li key={String(index)}>
              <GroupItem event={event} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GroupItem({ event }: { readonly event: HistoryEvent }) {
  switch (event.kind) {
    case "reputation":
      return (
        <span
          className="history-standing"
          style={{ ["--standing" as string]: reputationColorVar(event.tier) }}
        >
          {event.faction} · {event.standing}
        </span>
      );
    case "profession":
      return (
        <span className="history-chip">
          {event.profession} {event.to}{" "}
          <span className="history-gain">+{event.to - event.from}</span>
        </span>
      );
    case "mount":
      return <span className="history-chip history-mount">{event.mount}</span>;
    default:
      return <Detail event={event} />;
  }
}
