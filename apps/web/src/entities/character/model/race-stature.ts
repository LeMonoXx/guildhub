const statureByRaceId: Record<string, number> = {
  "7": 0,
  "9": 0,
  "3": 1,
  "1": 2,
  "5": 2,
  "10": 2,
  "2": 3,
  "4": 4,
  "11": 4,
  "96": 2,
  "8": 5,
  "6": 6,
};

export const raceStature = (raceId: string): number =>
  statureByRaceId[raceId] ?? 2;

/** Ground footprint radius, including elbow room, in model units at scale 1. */
export const raceRadius = (raceId: string): number =>
  0.34 + raceStature(raceId) * 0.085;

/**
 * Standing height in model units at scale 1, horns and pauldrons included.
 * Steps of 0.2 per stature; tauren stand clearly above the step.
 */
const heightByStature = [1.05, 1.25, 1.45, 1.65, 1.85, 2.05, 2.55] as const;

export const raceHeight = (raceId: string): number =>
  heightByStature[raceStature(raceId)] ?? heightByStature[2];

export const isSmallRace = (raceId: string): boolean =>
  raceStature(raceId) <= 1;

export const isLargeRace = (raceId: string): boolean =>
  raceStature(raceId) >= 4;
