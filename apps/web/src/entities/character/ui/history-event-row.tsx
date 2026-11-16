import type { HistoryEvent } from "@guildhub/contracts";
import { HistoryBadge } from "./history-badge";
import { HistoryDetail } from "./history-detail";
import { HistoryName } from "./history-name";

/** Everything else: a typed row whose badge says at a glance what happened. */
export function HistoryEventRow({ event }: { readonly event: HistoryEvent }) {
  return (
    <div className="history-row" data-kind={event.kind}>
      <HistoryBadge event={event} />
      <p className="history-event-text">
        <HistoryName event={event} /> <HistoryDetail event={event} />
      </p>
    </div>
  );
}
