import { useLocale } from "../../../shared/i18n";
import { formatDateTime } from "../../../shared/lib";
import type { TimelineEvent } from "../model/timeline-entries";
import { TimelineMember } from "./timeline-member";
import { TimelineMoment } from "./timeline-moment";

export function TimelineLoginRow({
  events,
}: {
  readonly events: readonly TimelineEvent[];
}) {
  const { t, locale } = useLocale();
  const newest = events[0];
  if (!newest) return null;
  return (
    <div className="timeline-logins">
      <span className="timeline-logins-label">
        {events.length === 1
          ? t("timeline.loggedInOne")
          : t("timeline.loggedInMany", { count: events.length })}
      </span>
      <span className="timeline-logins-names">
        {events.map((event) => (
          <span
            key={`${event.slug}-${event.at}`}
            className="timeline-login-chip"
            title={formatDateTime(event.at, locale)}
          >
            <TimelineMember event={event} />
          </span>
        ))}
      </span>
      <TimelineMoment at={newest.at} />
    </div>
  );
}
