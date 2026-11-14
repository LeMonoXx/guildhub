import type { ItemQuality } from "@guildhub/contracts";
import { FallbackImage } from "../../../shared/ui";
import { itemQualityColorVar } from "../model/item";

interface ItemIconProps {
  readonly iconUrl?: string | undefined;
  readonly quality?: ItemQuality | undefined;
  readonly size?: "sm" | "md" | "lg" | undefined;
  readonly label?: string | undefined;
}

export function ItemIcon({
  iconUrl,
  quality,
  size = "md",
  label,
}: ItemIconProps) {
  return (
    <span
      className={`item-icon item-icon-${size}`}
      data-quality={quality?.toLowerCase() ?? "empty"}
      style={
        quality
          ? { ["--item-quality" as string]: itemQualityColorVar(quality) }
          : undefined
      }
    >
      <FallbackImage
        src={iconUrl}
        alt={label ?? ""}
        loading="lazy"
        decoding="async"
        fallback={<span className="item-icon-empty" aria-hidden="true" />}
      />
    </span>
  );
}
