import {
  HistoryName,
  HistoryPortrait,
  wowClassColorVar,
} from "../../../entities/character";
import type { HistoryLane, LaneMark } from "../model/history-lanes";
import type { LaneScale } from "../model/lane-scale";
import { LaneMarkButton } from "./lane-mark";

interface HistoryLaneRowProps {
  readonly lane: HistoryLane;
  readonly scale: LaneScale;
  readonly selectedKey: string | undefined;
  readonly tabStopKey: string | undefined;
  readonly onPreview: (mark: LaneMark) => void;
  readonly onPin: (mark: LaneMark) => void;
}

/** A member's lane: their stretches of play, and a mark for every moment. */
export function HistoryLaneRow({
  lane,
  scale,
  selectedKey,
  tabStopKey,
  onPreview,
  onPin,
}: HistoryLaneRowProps) {
  return (
    <div
      className="lane"
      style={{
        ["--member-class" as string]: wowClassColorVar(lane.member.classId),
      }}
    >
      <div className="lane-member">
        <HistoryPortrait avatarUrl={lane.member.avatarUrl} fallback="✦" />
        <HistoryName event={lane.member} />
      </div>
      <div className="lane-track">
        {lane.sessions.map((session) => (
          <span
            key={session.from}
            className="lane-session"
            aria-hidden="true"
            style={{
              left: `${String(scale.x(session.from))}px`,
              width: `${String(scale.x(session.to) - scale.x(session.from))}px`,
            }}
          />
        ))}
        {lane.marks.map((mark) => (
          <LaneMarkButton
            key={mark.key}
            mark={mark}
            x={scale.x(mark.at)}
            selected={mark.key === selectedKey}
            tabStop={mark.key === tabStopKey}
            onPreview={onPreview}
            onPin={onPin}
          />
        ))}
      </div>
    </div>
  );
}
