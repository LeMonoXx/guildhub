import { describe, expect, it } from "vitest";
import { pickFeatured, selectFeaturedMembers } from "./featured-members.js";
import { rankId, type RosterMember } from "./roster-member.js";

function member(
  overrides: Partial<RosterMember> & Pick<RosterMember, "characterId" | "name">,
): RosterMember {
  return {
    surname: "Example",
    level: 80,
    rankId: rankId(2),
    classId: "1",
    raceId: "1",
    slug: `${overrides.name.toLowerCase()}-example`,
    ...overrides,
  };
}

describe("selectFeaturedMembers", () => {
  it("keeps at most eight members, guild master first", () => {
    const members = [
      member({ characterId: "8", name: "Zed", rankId: rankId(3) }),
      member({ characterId: "1", name: "Ann", rankId: rankId(1) }),
      member({ characterId: "2", name: "Bo", rankId: rankId(0) }),
      member({ characterId: "3", name: "Cy", rankId: rankId(2) }),
      member({ characterId: "4", name: "Di", rankId: rankId(2) }),
      member({ characterId: "5", name: "Ed", rankId: rankId(2) }),
      member({ characterId: "6", name: "Fa", rankId: rankId(2) }),
      member({ characterId: "7", name: "Go", rankId: rankId(2) }),
    ];
    expect(selectFeaturedMembers(members).map((item) => item.name)).toEqual([
      "Bo",
      "Ann",
      "Cy",
      "Di",
      "Ed",
      "Fa",
      "Go",
      "Zed",
    ]);
  });

  it("puts named members first and then follows rank", () => {
    const members = [
      member({ characterId: "1", name: "Ann", rankId: rankId(0) }),
      member({ characterId: "2", name: "Bo", rankId: rankId(1) }),
      member({
        characterId: "3",
        name: "Cy",
        surname: "Nightfall",
        rankId: rankId(4),
        slug: "cy-nightfall",
      }),
    ];
    expect(
      selectFeaturedMembers(members, 8, ["Cy Nightfall", "missing"]).map(
        (item) => item.name,
      ),
    ).toEqual(["Cy", "Ann", "Bo"]);
  });

  it("matches a name whose slug dropped a letter", () => {
    const members = [
      member({
        characterId: "9",
        name: "Filouo",
        surname: "Knørsok",
        slug: "filouo-kn-rsok",
        rankId: rankId(5),
      }),
      member({ characterId: "1", name: "Ann", rankId: rankId(0) }),
    ];
    expect(
      selectFeaturedMembers(members, 8, ["Filouo Knørsok"]).map(
        (item) => item.slug,
      ),
    ).toEqual(["filouo-kn-rsok", "ann-example"]);
  });
});

describe("pickFeatured", () => {
  it("prefers showable candidates and keeps featuring order", () => {
    expect(pickFeatured(["a", "b", "c", "d"], (id) => id !== "a", 2)).toEqual([
      "b",
      "c",
    ]);
  });

  it("fills with the rest when too few are showable", () => {
    expect(pickFeatured(["a", "b", "c"], (id) => id === "c", 2)).toEqual([
      "a",
      "c",
    ]);
  });
});
