import { useLocale } from "../../../shared/i18n";
import { wowClassColorVar } from "../model/class-color";
import { historyGlyphs, type HistoryEventOf } from "../model/history-event";
import { HistoryName } from "./history-name";
import { HistoryPortrait } from "./history-portrait";

/** A level-up as a headline: portrait, the new level, the climb. */
export function LevelUpCard({
  event,
}: {
  readonly event: HistoryEventOf<"level">;
}) {
  const { t } = useLocale();
  const gained = event.to - event.from;
  return (
    <article
      className="history-levelup"
      style={{ ["--member-class" as string]: wowClassColorVar(event.classId) }}
    >
      <span className="history-levelup-rays" aria-hidden="true" />
      <HistoryPortrait
        avatarUrl={event.avatarUrl}
        fallback={historyGlyphs[event.kind]}
      />
      <div className="history-levelup-body">
        <span className="history-levelup-label">{t("history.levelUp")}</span>
        <HistoryName event={event} />
        <span className="history-levelup-climb" title={event.surname}>
          {event.surname}
        </span>
        <span className="history-levelup-climb">
          {t("history.levelFrom", { from: event.from })}
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
