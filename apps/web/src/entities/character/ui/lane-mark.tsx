import type { ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import { historyGlyphs } from "../model/history-event";
import type {
  LaneAchievement,
  LaneMark,
  LaneMoment,
} from "../model/history-lanes";
import { AchievementIcon } from "./achievement-icon";

type Translate = ReturnType<typeof useLocale>["t"];

interface MarkLook<M extends LaneMark> {
  readonly kind: (mark: M) => string;
  readonly face: (mark: M) => ReactNode;
  readonly summary: (mark: M, t: Translate) => string;
}

const momentLook: MarkLook<LaneMoment> = {
  kind: (mark) => mark.lead,
  face: (mark) =>
    mark.level ? (
      <span className="lane-mark-level">{mark.level.to}</span>
    ) : (
      <>
        <span aria-hidden="true">{historyGlyphs[mark.lead]}</span>
        {mark.events.length > 1 ? (
          <span className="lane-mark-count">{mark.events.length}</span>
        ) : null}
      </>
    ),
  summary: (mark, t) => {
    if (mark.level) return t("history.event.level", { level: mark.level.to });
    if (mark.events.length === 1) return t("lanes.changeOne");
    return t("lanes.changes", { count: mark.events.length });
  },
};

const achievementLook: MarkLook<LaneAchievement> = {
  kind: () => "achievement",
  face: (mark) => (
    <AchievementIcon
      className="lane-mark-icon"
      iconUrl={mark.achievement.iconUrl}
      fallback="★"
    />
  ),
  summary: (mark) => mark.achievement.title,
};

const lookOf = (mark: LaneMark) =>
  (mark.type === "moment" ? momentLook : achievementLook) as MarkLook<LaneMark>;

interface LaneMarkButtonProps {
  readonly mark: LaneMark;
  readonly x: number;
  readonly selected: boolean;
  readonly onPreview: (mark: LaneMark) => void;
  readonly onPin: (mark: LaneMark) => void;
}

/** One point on a member's lane; pointing at it previews, pressing pins it. */
export function LaneMarkButton({
  mark,
  x,
  selected,
  onPreview,
  onPin,
}: LaneMarkButtonProps) {
  const { t, locale } = useLocale();
  const look = lookOf(mark);
  const time = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(mark.at));
  return (
    <button
      type="button"
      className="lane-mark"
      data-type={mark.type}
      data-kind={look.kind(mark)}
      data-level={mark.type === "moment" && mark.level !== undefined}
      aria-pressed={selected}
      aria-label={`${mark.member.name}, ${time}: ${look.summary(mark, t)}`}
      style={{ left: `${String(x)}px` }}
      onMouseEnter={() => {
        onPreview(mark);
      }}
      onFocus={() => {
        onPreview(mark);
      }}
      onClick={() => {
        onPin(mark);
      }}
    >
      {look.face(mark)}
    </button>
  );
}
