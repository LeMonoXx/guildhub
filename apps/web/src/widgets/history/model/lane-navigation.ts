import type { HistoryLane, HistoryLanes, LaneMark } from "./history-lanes";

export type LaneStep = "previous" | "next" | "up" | "down" | "first" | "last";

const STEP_KEYS: Readonly<Record<string, LaneStep>> = {
  ArrowLeft: "previous",
  ArrowRight: "next",
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "first",
  End: "last",
};

export const stepOf = (key: string): LaneStep | undefined => STEP_KEYS[key];

const distance = (mark: LaneMark, at: number) =>
  Math.abs(Date.parse(mark.at) - at);

const nearest = (
  lane: HistoryLane | undefined,
  at: string,
): LaneMark | undefined => {
  const time = Date.parse(at);
  return lane?.marks.reduce((best, mark) =>
    distance(mark, time) < distance(best, time) ? mark : best,
  );
};

/** Where a key moves from the mark `key`; a lane above or below lands nearest in time. */
export function stepFrom(
  lanes: HistoryLanes,
  key: string,
  step: LaneStep,
): LaneMark | undefined {
  const row = lanes.lanes.findIndex((lane) =>
    lane.marks.some((mark) => mark.key === key),
  );
  const lane = lanes.lanes[row];
  if (!lane) return undefined;
  const index = lane.marks.findIndex((mark) => mark.key === key);
  const { at } = lane.marks[index] as LaneMark;
  const moves: Record<LaneStep, () => LaneMark | undefined> = {
    previous: () => lane.marks[index - 1],
    next: () => lane.marks[index + 1],
    first: () => lane.marks[0],
    last: () => lane.marks.at(-1),
    up: () => nearest(lanes.lanes[row - 1], at),
    down: () => nearest(lanes.lanes[row + 1], at),
  };
  return moves[step]();
}
