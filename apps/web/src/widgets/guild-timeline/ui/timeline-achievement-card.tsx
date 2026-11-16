import { AchievementHover, AchievementIcon } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import type { TimelineEvent } from "../model/timeline-entries";
import { TimelineMember } from "./timeline-member";
import { TimelineMoment } from "./timeline-moment";

export function TimelineAchievementCard({
  event,
}: {
  readonly event: TimelineEvent;
}) {
  const { t } = useLocale();
  return (
    <div className="timeline-card timeline-achievement">
      <AchievementIcon
        className="timeline-trophy"
        iconUrl={event.iconUrl}
        fallback="✦"
      />
      <div className="timeline-achievement-body">
        <span className="eyebrow">{t("timeline.achievementEyebrow")}</span>
        <div>
          <TimelineMember event={event} /> {t("timeline.earnedShort")}{" "}
          <AchievementHover
            achievement={{
              name: event.title,
              iconUrl: event.iconUrl,
              details: event.details,
            }}
          >
            <strong className="timeline-title">{event.title}</strong>
          </AchievementHover>
        </div>
      </div>
      <TimelineMoment at={event.at} />
    </div>
  );
}
