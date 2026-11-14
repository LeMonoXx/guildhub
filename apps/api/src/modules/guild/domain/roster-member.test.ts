import { describe, expect, it } from "vitest";
import { isGuildMaster, rankId, type RosterMember } from "./roster-member.js";

function member(rank: number): RosterMember {
  return {
    characterId: "101",
    name: "Guildmaster",
    surname: "Example",
    level: 80,
    rankId: rankId(rank),
    classId: "1",
    raceId: "1",
    slug: "guildmaster-example",
  };
}

describe("isGuildMaster", () => {
  it("is true only for rank 0", () => {
    expect(isGuildMaster(member(0))).toBe(true);
    expect(isGuildMaster(member(1))).toBe(false);
  });
});
