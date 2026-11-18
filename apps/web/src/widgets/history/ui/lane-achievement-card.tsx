import {
  AchievementHover,
  AchievementIcon,
  HistoryName,
  type HistoryEventOf,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";

/** An achievement shines on its own card, its icon as the trophy. */
export function LaneAchievementCard({
  event,
}: {
  readonly event: HistoryEventOf<"achievement">;
}) {
  const { t } = useLocale();
  return (
    <div className="history-timeline-card history-timeline-achievement">
      <AchievementIcon
        className="history-timeline-trophy"
        iconUrl={event.iconUrl}
        fallback="★"
      />
      <div className="history-timeline-achievement-body">
        <span className="history-timeline-eyebrow">
          {t("timeline.achievementEyebrow")}
        </span>
        <p>
          <HistoryName event={event} /> {t("timeline.earnedShort")}{" "}
          <AchievementHover
            achievement={{ name: event.achievement, iconUrl: event.iconUrl }}
          >
            <strong className="history-timeline-achievement-title">
              {event.achievement}
            </strong>
          </AchievementHover>
        </p>
      </div>
    </div>
  );
}
