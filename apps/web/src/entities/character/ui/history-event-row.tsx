import type { HistoryEvent } from "@guildhub/contracts";
import { HistoryBadge } from "./history-badge";
import { HistoryDetail } from "./history-detail";

/** One change of a member already named around it, its badge saying what kind. */
export function HistoryEventRow({ event }: { readonly event: HistoryEvent }) {
  return (
    <div className="history-row" data-kind={event.kind}>
      <HistoryBadge event={event} />
      <p className="history-event-text">
        <HistoryDetail event={event} />
      </p>
    </div>
  );
}
