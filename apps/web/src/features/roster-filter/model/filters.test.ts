import { describe, expect, test } from "vitest";
import { matchesRosterFilters, parseRosterSearch } from "./filters";

const member = {
  characterId: "101",
  name: "Shade",
  surname: "Veil",
  level: 80,
  rankId: 0,
  classId: "4",
  raceId: "1",
  slug: "shade",
};

describe("roster filters", () => {
  test("matches a case-insensitive name query", () => {
    expect(matchesRosterFilters(member, { q: "shade" })).toBe(true);
    expect(matchesRosterFilters(member, { q: "veil" })).toBe(true);
    expect(matchesRosterFilters(member, { q: "mage" })).toBe(false);
  });

  test("intersects class, race, and rank", () => {
    expect(matchesRosterFilters(member, { classId: "4", rankId: 0 })).toBe(
      true,
    );
    expect(matchesRosterFilters(member, { classId: "1" })).toBe(false);
    expect(matchesRosterFilters(member, { raceId: "4" })).toBe(false);
  });

  test("parses URL search values", () => {
    expect(
      parseRosterSearch({ q: "shade", classId: "4", rankId: "0" }),
    ).toEqual({
      q: "shade",
      classId: "4",
      raceId: undefined,
      rankId: 0,
    });
  });
});
