import { useLocale } from "../../../shared/i18n";
import { wowClassColorVar } from "../model/class-color";
import type { HistoryEventOf } from "../model/history-event";
import { HistoryName } from "./history-name";
import { HistoryPortrait } from "./history-portrait";

/** A level-up is the headline of its day: portrait, the new level, the climb. */
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
      <HistoryPortrait event={event} />
      <div className="history-levelup-body">
        <span className="history-levelup-label">{t("history.levelUp")}</span>
        <HistoryName event={event} />
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
