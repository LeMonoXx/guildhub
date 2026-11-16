import { useLocale } from "../../../shared/i18n";
import { historyGlyphs, type HistoryEventOf } from "../model/history-event";
import { HistoryName } from "./history-name";

/** Someone came or went; it reads as a banner across the day. */
export function RosterBanner({
  event,
}: {
  readonly event: HistoryEventOf<"joined" | "left">;
}) {
  const { t } = useLocale();
  return (
    <p className="history-banner" data-kind={event.kind}>
      <span className="history-banner-glyph" aria-hidden="true">
        {historyGlyphs[event.kind]}
      </span>
      <span>
        <HistoryName event={event} /> {t(`history.event.${event.kind}`)}
      </span>
    </p>
  );
}
