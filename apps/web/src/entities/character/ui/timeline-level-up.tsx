import type { ReactNode } from "react";
import { wowClassColorVar } from "../model/class-color";
import type { HistoryEventOf } from "../model/history-event";
import { LevelUpCard } from "./level-up-card";

const SPARKS = 12;

/** A level-up with the member cheering beside it and sparks bursting off. */
export function TimelineLevelUp({
  event,
  celebration,
}: {
  readonly event: HistoryEventOf<"level">;
  readonly celebration: ReactNode;
}) {
  return (
    <div
      className="history-timeline-levelup"
      data-celebrating={celebration !== undefined && celebration !== null}
      style={{ ["--member-class" as string]: wowClassColorVar(event.classId) }}
    >
      {celebration ? (
        <div className="history-timeline-cheer">{celebration}</div>
      ) : null}
      <LevelUpCard event={event} />
      <span className="history-timeline-sparks" aria-hidden="true">
        {Array.from({ length: SPARKS }, (_, index) => (
          <span key={index} style={{ ["--spark" as string]: String(index) }} />
        ))}
      </span>
    </div>
  );
}
