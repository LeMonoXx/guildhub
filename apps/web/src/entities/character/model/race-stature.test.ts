import { describe, expect, test } from "vitest";
import { isLargeRace, isSmallRace, raceStature } from "./race-stature";

describe("raceStature", () => {
  test("orders classic races from gnome to tauren", () => {
    expect(raceStature("7")).toBeLessThan(raceStature("3"));
    expect(raceStature("3")).toBeLessThan(raceStature("1"));
    expect(raceStature("1")).toBeLessThan(raceStature("4"));
    expect(raceStature("4")).toBeLessThan(raceStature("8"));
    expect(raceStature("8")).toBeLessThan(raceStature("6"));
  });

  test("marks gnomes and dwarves small and tauren large", () => {
    expect(isSmallRace("7")).toBe(true);
    expect(isSmallRace("3")).toBe(true);
    expect(isSmallRace("1")).toBe(false);
    expect(isLargeRace("6")).toBe(true);
    expect(isLargeRace("8")).toBe(true);
    expect(isLargeRace("4")).toBe(true);
    expect(isLargeRace("1")).toBe(false);
  });
});
