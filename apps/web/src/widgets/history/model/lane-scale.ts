const HOUR = 3_600_000;

/** Pixels per hour, from the whole stretch at a glance to single checks. */
export const LANE_ZOOMS = [6, 12, 24, 40, 64] as const;
export const DEFAULT_LANE_ZOOM = 2;

const TICK_STEPS = [1, 2, 3, 6, 12, 24] as const;
const MIN_TICK_SPACING = 48;
/** Room a day's label takes before the next hour may be named. */
const DAY_LABEL_SPACE = 92;

export interface LaneTick {
  readonly at: number;
  readonly x: number;
  /** Local midnight. */
  readonly day: boolean;
}

export interface LaneScale {
  readonly width: number;
  readonly x: (at: string | number) => number;
  readonly ticks: readonly LaneTick[];
  readonly now: number;
}

/** Maps time onto the lanes, padded by an hour on both ends. */
export function laneScale(
  from: string,
  to: string,
  pxPerHour: number,
  now: number = Date.now(),
): LaneScale {
  const start = Math.floor(Date.parse(from) / HOUR) * HOUR - HOUR;
  const end = Math.max(Date.parse(to), now) + HOUR;
  const x = (at: string | number) =>
    (((typeof at === "number" ? at : Date.parse(at)) - start) / HOUR) *
    pxPerHour;
  const step =
    TICK_STEPS.find((hours) => hours * pxPerHour >= MIN_TICK_SPACING) ?? 24;
  const ticks: LaneTick[] = [];
  let dayX = Number.NEGATIVE_INFINITY;
  for (let at = start; at <= end; at += HOUR) {
    const hour = new Date(at).getHours();
    const day = hour === 0;
    if (day) dayX = x(at);
    const named = day || (hour % step === 0 && x(at) - dayX >= DAY_LABEL_SPACE);
    if (named) ticks.push({ at, x: x(at), day });
  }
  return { width: x(end), x, ticks, now };
}
