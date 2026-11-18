import { useLocale } from "../../../shared/i18n";
import type { LaneScale } from "../model/lane-scale";

/** Days and hours along the top of the lanes. */
export function LaneAxis({ scale }: { readonly scale: LaneScale }) {
  const { locale } = useLocale();
  const hour = new Intl.DateTimeFormat(locale, { hour: "numeric" });
  const day = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return (
    <div className="lane-axis" aria-hidden="true">
      <div className="lane-axis-spacer" />
      <div className="lane-axis-track">
        {scale.ticks.map((tick) => (
          <span
            key={tick.at}
            className="lane-tick"
            data-day={tick.day}
            style={{ left: `${String(tick.x)}px` }}
          >
            {(tick.day ? day : hour).format(tick.at)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Midnights and the present, drawn through every lane. */
export function LaneGrid({ scale }: { readonly scale: LaneScale }) {
  const { t } = useLocale();
  return (
    <div className="lane-grid" aria-hidden="true">
      {scale.ticks
        .filter((tick) => tick.day)
        .map((tick) => (
          <span
            key={tick.at}
            className="lane-grid-day"
            style={{ left: `${String(tick.x)}px` }}
          />
        ))}
      <span
        className="lane-grid-now"
        style={{ left: `${String(scale.x(scale.now))}px` }}
      >
        <span>{t("lanes.now")}</span>
      </span>
    </div>
  );
}
