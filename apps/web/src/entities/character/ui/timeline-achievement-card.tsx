import { useLocale } from "../../../shared/i18n";
import type { TimelineAchievement } from "../model/history-lanes";
import { AchievementHover } from "./achievement-hover";
import { AchievementIcon } from "./achievement-icon";
import { HistoryName } from "./history-name";

/** An achievement shines on its own card, its icon as the trophy. */
export function TimelineAchievementCard({
  achievement,
}: {
  readonly achievement: TimelineAchievement;
}) {
  const { t } = useLocale();
  return (
    <div className="history-timeline-card history-timeline-achievement">
      <AchievementIcon
        className="history-timeline-trophy"
        iconUrl={achievement.iconUrl}
        fallback="★"
      />
      <div className="history-timeline-achievement-body">
        <span className="history-timeline-eyebrow">
          {t("timeline.achievementEyebrow")}
        </span>
        <p>
          <HistoryName event={achievement} /> {t("timeline.earnedShort")}{" "}
          <AchievementHover
            achievement={{
              name: achievement.title,
              iconUrl: achievement.iconUrl,
              details: achievement.details,
            }}
          >
            <strong className="history-timeline-achievement-title">
              {achievement.title}
            </strong>
          </AchievementHover>
        </p>
      </div>
    </div>
  );
}
