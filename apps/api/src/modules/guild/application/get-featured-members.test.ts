import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { rankId, type RosterMember } from "../domain/roster-member.js";
import { makeGetFeaturedMembers } from "./get-featured-members.js";

const guild = { slug: "example-guild" };
const now = new Date("2026-11-13T12:00:00.000Z");

function member(name: string, rank: number, id: string): RosterMember {
  return {
    characterId: id,
    name,
    surname: "Example",
    level: 80,
    rankId: rankId(rank),
    classId: "1",
    raceId: "1",
    slug: `${name.toLowerCase()}-example`,
  };
}

describe("get-featured-members", () => {
  it("returns the highest-ranked members from the roster", async () => {
    const members = [
      member("Zed", 3, "3"),
      member("Ann", 0, "1"),
      member("Bo", 1, "2"),
    ];
    const result = await makeGetFeaturedMembers({
      getRoster: () =>
        Promise.resolve(ok({ data: members, fetchedAt: now, stale: false })),
    })(guild);
    expect(result.ok && result.value.data.map((item) => item.name)).toEqual([
      "Ann",
      "Bo",
      "Zed",
    ]);
  });

  it("forwards roster errors", async () => {
    const result = await makeGetFeaturedMembers({
      getRoster: () => Promise.resolve(err(appError("upstream.unavailable"))),
    })(guild);
    expect(result).toEqual({
      ok: false,
      error: { code: "upstream.unavailable" },
    });
  });
});
