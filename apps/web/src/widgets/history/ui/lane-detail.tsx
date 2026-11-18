import type { ReactNode } from "react";
import {
  HistoryEventRow,
  HistoryName,
  HistoryPortrait,
  LevelUpCard,
  type HistoryEventOf,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import type {
  LaneAchievement,
  LaneMark,
  LaneMoment,
  MemberRef,
} from "../model/history-lanes";
import { LaneAchievementCard } from "./lane-achievement-card";

export type RenderCelebration = (event: HistoryEventOf<"level">) => ReactNode;

function DetailHead({
  member,
  at,
}: {
  readonly member: MemberRef;
  readonly at: string;
}) {
  const { locale } = useLocale();
  return (
    <header className="lane-detail-head">
      <HistoryPortrait avatarUrl={member.avatarUrl} fallback="✦" />
      <HistoryName event={member} />
      <time dateTime={at}>
        {new Intl.DateTimeFormat(locale, {
          weekday: "long",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(at))}
      </time>
    </header>
  );
}

function MomentDetail({
  moment,
  renderCelebration,
}: {
  readonly moment: LaneMoment;
  readonly renderCelebration: RenderCelebration | undefined;
}) {
  const changes = moment.events.filter((event) => event.kind !== "level");
  const celebration = moment.level && renderCelebration?.(moment.level);
  return (
    <>
      <DetailHead member={moment.member} at={moment.at} />
      {moment.level ? (
        <div className="lane-detail-level" data-cheering={Boolean(celebration)}>
          <LevelUpCard event={moment.level} />
          {celebration ? (
            <div className="lane-detail-cheer">{celebration}</div>
          ) : null}
        </div>
      ) : null}
      {changes.length > 0 ? (
        <ul className="lane-detail-changes">
          {changes.map((event, index) => (
            <li key={`${event.kind}-${String(index)}`}>
              <HistoryEventRow event={event} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function AchievementDetail({ mark }: { readonly mark: LaneAchievement }) {
  return (
    <>
      <DetailHead member={mark.member} at={mark.at} />
      <LaneAchievementCard event={mark.event} />
    </>
  );
}

/** What happened at the mark that is pointed at or pinned. */
export function LaneDetail({
  mark,
  renderCelebration,
}: {
  readonly mark: LaneMark;
  readonly renderCelebration: RenderCelebration | undefined;
}) {
  return (
    <article className="lane-detail" data-type={mark.type} aria-live="polite">
      {mark.type === "moment" ? (
        <MomentDetail moment={mark} renderCelebration={renderCelebration} />
      ) : (
        <AchievementDetail mark={mark} />
      )}
    </article>
  );
}
