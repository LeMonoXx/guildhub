import type { ReactNode } from "react";
import { FallbackImage } from "../../../shared/ui";

interface AchievementIconProps {
  readonly iconUrl?: string | undefined;
  /** Shown when the achievement has no icon or it fails to load. */
  readonly fallback: ReactNode;
  readonly className?: string | undefined;
}

export function AchievementIcon({
  iconUrl,
  fallback,
  className,
}: AchievementIconProps) {
  return (
    <span
      className={["achievement-icon", className].filter(Boolean).join(" ")}
      data-empty={iconUrl === undefined}
      aria-hidden="true"
    >
      <FallbackImage
        src={iconUrl}
        loading="lazy"
        decoding="async"
        fallback={fallback}
      />
    </span>
  );
}
