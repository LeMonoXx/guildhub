import type { AchievementDetails } from "@guildhub/contracts";
import { useId, type ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import { AchievementIcon } from "./achievement-icon";

export interface AchievementSummary {
  readonly name: string;
  readonly iconUrl?: string | undefined;
  readonly details?: AchievementDetails | undefined;
}

interface AchievementHoverProps {
  readonly achievement: AchievementSummary;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/** The in-game achievement tooltip: what it is and what it takes. */
export function AchievementTooltip({
  achievement,
  id,
}: {
  readonly achievement: AchievementSummary;
  readonly id?: string | undefined;
}) {
  const { t } = useLocale();
  const { details } = achievement;
  return (
    <div className="wow-tooltip achievement-tooltip" role="tooltip" id={id}>
      <div className="achievement-tooltip-head">
        <AchievementIcon
          className="achievement-tooltip-icon"
          iconUrl={achievement.iconUrl}
          fallback="✦"
        />
        <div>
          <p className="wow-tooltip-name achievement-tooltip-name">
            {achievement.name}
          </p>
          {details?.category ? (
            <p className="achievement-tooltip-category">{details.category}</p>
          ) : null}
        </div>
      </div>
      <p className="achievement-tooltip-description">
        {details?.description ?? t("achievement.noDescription")}
      </p>
      {details?.criteria && details.criteria.length > 0 ? (
        <ul className="achievement-tooltip-criteria">
          {details.criteria.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {details?.reward ? (
        <p className="achievement-tooltip-reward">
          {t("achievement.reward", { reward: details.reward })}
        </p>
      ) : null}
    </div>
  );
}

/** Wraps an achievement mention so hovering or focusing it explains the achievement. */
export function AchievementHover({
  achievement,
  children,
  className,
}: AchievementHoverProps) {
  const tooltipId = useId();
  return (
    <span
      className={["achievement-hover", className].filter(Boolean).join(" ")}
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      {children}
      <span className="achievement-hover-tip">
        <AchievementTooltip achievement={achievement} id={tooltipId} />
      </span>
    </span>
  );
}
