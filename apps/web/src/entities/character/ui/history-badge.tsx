import type { HistoryEvent } from "@guildhub/contracts";
import { historyGlyphs } from "../model/history-event";
import { itemQualityColorVar } from "../model/item";
import { ItemIcon } from "./item-icon";

export function HistoryBadge({ event }: { readonly event: HistoryEvent }) {
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
      {historyGlyphs[event.kind]}
    </span>
  );
}
