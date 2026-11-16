import { describe, expect, test } from "vitest";
import type { FeaturedMember } from "@guildhub/contracts";
import { createFixtureGuildSource } from "../../../entities/guild/testing";
import {
  isLargeRace,
  isSmallRace,
  raceRadius,
} from "../../../entities/character";
import { arrangeTroop, silhouetteOf } from "./arrange-troop";

const withRace = (
  member: FeaturedMember,
  raceId: string,
  slug: string,
): FeaturedMember => ({
  ...member,
  raceId,
  slug,
});

describe("arrangeTroop", () => {
  test("puts small races in front of large races", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const [first, second, third] = members;
    if (!first || !second || !third) throw new Error("need featured members");

    const places = arrangeTroop([
      withRace(first, "6", "tall-tauren"),
      withRace(second, "7", "small-gnome"),
      withRace(third, "8", "tall-troll"),
    ]);

    const tauren = places.find((place) => place.member.slug === "tall-tauren");
    const troll = places.find((place) => place.member.slug === "tall-troll");
    const gnome = places.find((place) => place.member.slug === "small-gnome");

    expect(tauren?.slot.z).toBeLessThan(gnome?.slot.z ?? 0);
    expect(troll?.slot.z).toBeLessThan(gnome?.slot.z ?? 0);
    expect(tauren?.kneels).toBe(false);
    expect(troll?.kneels).toBe(false);
  });

  test("kneels the smallest race only in front of the largest", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const [first, second, third, fourth] = members;
    if (!first || !second || !third || !fourth) {
      throw new Error("need featured members");
    }

    const places = arrangeTroop([
      withRace(first, "3", "dwarf"),
      withRace(second, "7", "gnome"),
      withRace(third, "6", "tauren"),
      withRace(fourth, "4", "night-elf"),
    ]);

    const kneelers = places.filter((place) => place.kneels);
    expect(kneelers).toHaveLength(1);
    expect(kneelers[0]?.member.slug).toBe("gnome");

    const behind = places.find((place) => place.member.slug === "tauren");
    expect(behind).toBeDefined();
    expect(
      Math.abs((kneelers[0]?.slot.x ?? 0) - (behind?.slot.x ?? 0)),
    ).toBeGreaterThan(0.25);
    expect(
      Math.abs((kneelers[0]?.slot.x ?? 0) - (behind?.slot.x ?? 0)),
    ).toBeLessThan(1);
    expect(kneelers[0]?.slot.z).toBeGreaterThan(behind?.slot.z ?? 0);
    expect(isLargeRace(behind?.member.raceId ?? "")).toBe(true);
    expect(isSmallRace(kneelers[0]?.member.raceId ?? "")).toBe(true);
  });

  test("gives a shield bearer extra room forward and to the side", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const [first, second, third, fourth] = members;
    if (!first || !second || !third || !fourth) {
      throw new Error("need featured members");
    }
    const lineup = (carries: FeaturedMember["carries"]) => {
      const places = arrangeTroop([
        withRace(first, "3", "dwarf"),
        withRace(second, "7", "gnome"),
        { ...withRace(third, "6", "tauren"), carries },
        withRace(fourth, "4", "night-elf"),
      ]);
      const tauren = places.find((place) => place.member.slug === "tauren");
      const gnome = places.find((place) => place.member.slug === "gnome");
      if (!tauren || !gnome) throw new Error("missing place");
      return {
        forward: gnome.slot.z - tauren.slot.z,
        aside: Math.abs(gnome.slot.x - tauren.slot.x),
        body: silhouetteOf(tauren).halfWidth,
      };
    };

    const bare = lineup(undefined);
    const shielded = lineup(["shield"]);
    expect(shielded.forward).toBeGreaterThan(bare.forward + 0.3);
    expect(shielded.aside).toBeGreaterThan(bare.aside);
    expect(shielded.body).toBeGreaterThan(bare.body);
  });

  test("never kneels without a large race behind the kneeler", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(
      members
        .slice(0, 4)
        .map((member, index) =>
          withRace(
            member,
            index % 2 === 0 ? "1" : "3",
            `medium-${String(index)}`,
          ),
        ),
    );

    expect(places.some((place) => place.kneels)).toBe(false);
    for (const place of places) {
      if (isSmallRace(place.member.raceId)) {
        expect(place.slot.z).toBeGreaterThan(0.5);
      }
    }
  });

  test("keeps the current featured gnome kneeling in front of the night elf", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const kneeler = places.find((place) => place.kneels);
    expect(kneeler).toBeDefined();
    if (kneeler === undefined) return;
    const behind = places.find(
      (place) =>
        !place.kneels &&
        Math.abs(place.slot.x - kneeler.slot.x) < 0.75 &&
        place.slot.z < kneeler.slot.z,
    );

    expect(kneeler.member.raceId).toBe("7");
    expect(behind?.member.raceId).toBe("4");
    expect(Math.abs(kneeler.slot.x - (behind?.slot.x ?? 0))).toBeGreaterThan(
      0.25,
    );
    expect(
      places.some(
        (place) =>
          !place.kneels &&
          place.slot.z === kneeler.slot.z &&
          place.member !== kneeler.member,
      ),
    ).toBe(false);
    for (const place of places) {
      if (place.kneels || place.slot.z <= (behind?.slot.z ?? 0) + 0.2) continue;
      expect(Math.abs(place.slot.x - kneeler.slot.x)).toBeGreaterThan(0.5);
    }
  });

  test("centers the troop on stage instead of leaving dead space on one side", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const xs = places.map((place) => place.slot.x);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    expect((min + max) / 2).toBeCloseTo(0, 1);
    expect(Math.abs(min)).toBeCloseTo(Math.abs(max), 1);
  });

  test("packs actors using race radii instead of a fixed spread", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const xs = places.map((place) => place.slot.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(5.2);
    for (const [index, place] of places.entries()) {
      for (const other of places.slice(index + 1)) {
        const sameRow = Math.abs(place.slot.z - other.slot.z) < 0.4;
        if (!sameRow) continue;
        const minDistance =
          raceRadius(place.member.raceId) +
          raceRadius(other.member.raceId) +
          0.08;
        expect(
          Math.hypot(place.slot.x - other.slot.x, place.slot.z - other.slot.z),
        ).toBeGreaterThan(minDistance * 0.9);
      }
    }
  });
});
