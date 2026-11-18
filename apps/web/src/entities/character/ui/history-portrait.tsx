import { FallbackImage } from "../../../shared/ui";

export function HistoryPortrait({
  avatarUrl,
  fallback,
}: {
  readonly avatarUrl?: string | undefined;
  /** Shown when the member has no avatar or it fails to load. */
  readonly fallback: string;
}) {
  return (
    <span className="history-portrait" aria-hidden="true">
      <FallbackImage
        src={avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        fallback={<span className="history-portrait-glyph">{fallback}</span>}
      />
    </span>
  );
}
