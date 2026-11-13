import { describe, expect, test } from "vitest";
import { classGlyph } from "./class-glyphs";
import { raceGlyph } from "./race-glyphs";

describe("wow presentation glyphs", () => {
  test("covers every classic and later class id", () => {
    for (const classId of [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
    ])
      expect(classGlyph(classId).paths.length).toBeGreaterThan(0);
  });

  test("covers alliance and horde race ids used in classic-era rosters", () => {
    for (const raceId of ["1", "2", "3", "4", "5", "6", "7", "8", "10", "11"])
      expect(raceGlyph(raceId).paths.length).toBeGreaterThan(0);
  });
});
