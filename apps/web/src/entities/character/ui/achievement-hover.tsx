import { useId, type ReactNode } from "react";
import {
  AchievementTooltip,
  type AchievementSummary,
} from "./achievement-tooltip";

interface AchievementHoverProps {
  readonly achievement: AchievementSummary;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/** Wraps an achievement mention so hovering or focusing it explains the achievement. */
export function AchievementHover({
  achievement,
  children,
  className,
}: AchievementHoverProps) {
  const tooltipId = useId();
  return (
    <button
      type="button"
      className={["achievement-hover", className].filter(Boolean).join(" ")}
      aria-describedby={tooltipId}
    >
      {children}
      <span className="achievement-hover-tip">
        <AchievementTooltip achievement={achievement} id={tooltipId} />
      </span>
    </button>
  );
}
