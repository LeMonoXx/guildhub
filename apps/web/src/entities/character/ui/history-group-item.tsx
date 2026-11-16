import type { HistoryEvent } from "@guildhub/contracts";
import { reputationColorVar } from "../model/vitals";
import { HistoryDetail } from "./history-detail";

/** One change inside a group, shortened because the group names the kind. */
export function HistoryGroupItem({ event }: { readonly event: HistoryEvent }) {
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
      return <HistoryDetail event={event} />;
  }
}
