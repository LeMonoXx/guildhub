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
  "8": 5,
  "6": 6,
};

export const raceStature = (raceId: string): number =>
  statureByRaceId[raceId] ?? 2;

export const isSmallRace = (raceId: string): boolean =>
  raceStature(raceId) <= 1;

export const isLargeRace = (raceId: string): boolean =>
  raceStature(raceId) >= 4;
