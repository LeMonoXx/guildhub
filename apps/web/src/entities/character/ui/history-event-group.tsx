import type { HistoryEvent } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { historyGlyphs } from "../model/history-event";
import { HistoryGroupItem } from "./history-group-item";
import { HistoryName } from "./history-name";

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
        {historyGlyphs[first.kind]}
        <span className="history-glyph-count">{events.length}</span>
      </span>
      <div className="history-event-text">
        <p>
          <HistoryName event={first} />{" "}
          {t(`history.group.${first.kind}`, { count: events.length })}
        </p>
        <ul className="history-group-list">
          {events.map((event, index) => (
            <li key={String(index)}>
              <HistoryGroupItem event={event} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
