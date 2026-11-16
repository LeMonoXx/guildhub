import type { HistoryEvent } from "@guildhub/contracts";
import { FallbackImage } from "../../../shared/ui";
import { historyGlyphs } from "../model/history-event";

export function HistoryPortrait({ event }: { readonly event: HistoryEvent }) {
  return (
    <span className="history-portrait" aria-hidden="true">
      <FallbackImage
        src={event.avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        fallback={
          <span className="history-portrait-glyph">
            {historyGlyphs[event.kind]}
          </span>
        }
      />
    </span>
  );
}
