import { readFileSync } from "node:fs";
import { join } from "node:path";
import { teleportFlashProgress } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { createFixtureGuildSource } from "../../../entities/guild";
import { arrangeTroop } from "./arrange-troop";
import {
  buildLineupScene,
  facingToward,
  planLineupEntrances,
} from "./build-lineup-scene";

describe("guild lineup scene", () => {
  test("builds at most six data-driven actors", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const scene = buildLineupScene(members);
    const actors = scene.declarations.filter(
      (declaration) => declaration.kind === "actor",
    );
    expect(actors.length).toBeLessThanOrEqual(6);
    expect(actors).toHaveLength(Math.min(6, members.length));
    expect(new Set(actors.map((actor) => actor.id))).toEqual(
      new Set(members.slice(0, 6).map((member) => member.slug)),
    );
    expect(new Set(actors.map((actor) => actor.manifest)).size).toBe(1);
  });

  test("stops walking before the slot, a shield carrier earlier still", async () => {
    const fixture = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const members = fixture.map((member, index) =>
      index === 0 ? { ...member, carries: ["shield" as const] } : member,
    );
    const places = arrangeTroop(members);
    const entrances = planLineupEntrances(places);
    const scene = buildLineupScene(members);
    const stopLead = (slug: string) => {
      const index = places.findIndex((place) => place.member.slug === slug);
      const clips = scene.tracks.find(
        (track) => track.kind === "clip" && track.target === slug,
      );
      if (clips?.kind !== "clip") return 0;
      return (
        (entrances[index]?.settledAt ?? 0) - (clips.keyframes[2]?.timeMs ?? 0)
      );
    };
    const carrier = members[0]?.slug ?? "";
    const others = members.slice(1, 6).map((member) => stopLead(member.slug));
    expect(Math.min(...others)).toBeGreaterThan(0);
    expect(stopLead(carrier)).toBeGreaterThan(Math.max(...others));
  });

  test("never raises a shield while walking or idling", async () => {
    const fixture = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const members = fixture.map((member) => ({
      ...member,
      pose: "Ready1H",
      carries: ["shield" as const],
    }));
    const clips = buildLineupScene(members).tracks.flatMap((track) =>
      track.kind === "clip"
        ? track.keyframes.map((keyframe) => keyframe.value.animationGroup)
        : [],
    );
    expect(clips).toContain("Walk");
    for (const raising of ["Ready1H", "StealthStand", "StealthWalk"])
      expect(clips).not.toContain(raising);
  });

  test("sorts the troop by stature with one kneel only in front of a large race", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const xs = places.map((place) => place.slot.x);
    const span = Math.max(...xs) - Math.min(...xs);
    expect(span).toBeGreaterThan(1.6);
    expect(span).toBeLessThan(5.2);

    const kneelers = places.filter((place) => place.kneels);
    expect(kneelers).toHaveLength(1);
    const kneeler = kneelers[0];
    expect(kneeler).toBeDefined();
    if (kneeler === undefined) return;
    const behind = places.find(
      (place) =>
        !place.kneels &&
        Math.abs(place.slot.x - kneeler.slot.x) < 0.75 &&
        place.slot.z < kneeler.slot.z,
    );
    expect(behind).toBeDefined();
    expect(kneeler.slot.z).toBeGreaterThan(behind?.slot.z ?? 0);
    expect(Math.abs(kneeler.slot.x - (behind?.slot.x ?? 0))).toBeGreaterThan(
      0.25,
    );
  });

  test("walks actors in slowly from the sides and the back", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const scene = buildLineupScene(members);
    const locomotion = new Set(["Walk", "StealthWalk"]);
    const entrances = planLineupEntrances(places);
    let fromSide = 0;
    let fromBack = 0;

    for (const [index, place] of places.entries()) {
      const transform = scene.tracks.find(
        (track) =>
          track.kind === "transform" && track.target === place.member.slug,
      );
      const clips = scene.tracks.find(
        (track) => track.kind === "clip" && track.target === place.member.slug,
      );
      expect(transform?.kind).toBe("transform");
      expect(clips?.kind).toBe("clip");
      if (transform?.kind !== "transform" || clips?.kind !== "clip") continue;

      const start = transform.keyframes[0]?.value.position;
      const entrance = entrances[index];
      const side = entrance?.side ?? "back";
      expect(start).toEqual(entrance?.start);
      expect(start?.y).toBe(0);
      if (side === "back") fromBack += 1;
      else fromSide += 1;

      const enterAt = transform.keyframes[1]?.timeMs ?? 0;
      const settledAt = transform.keyframes[2]?.timeMs ?? 0;
      expect(enterAt).toBe(entrance?.enterAt);
      expect(settledAt - enterAt).toBeGreaterThanOrEqual(5000);
      expect(transform.keyframes[2]?.value.rotation).toEqual(
        transform.keyframes[1]?.value.rotation,
      );
      expect(transform.keyframes[3]?.value.rotation).toEqual(
        transform.keyframes[1]?.value.rotation,
      );

      if (side !== "back" && start) {
        const heading = facingToward(start, place.slot).y;
        expect(Math.abs(heading + Math.PI / 2)).toBeGreaterThan(0.7);
        expect(transform.keyframes[1]?.value.rotation.y).toBeCloseTo(heading);
      }

      const enterClip = clips.keyframes[1];
      expect(enterClip?.timeMs).toBe(entrance?.enterAt);
      expect(locomotion.has(enterClip?.value.animationGroup ?? "")).toBe(true);
      expect(clips.keyframes[0]?.value.animationGroup).toBe(
        enterClip?.value.animationGroup === "StealthWalk"
          ? "StealthStand"
          : "Stand",
      );
      expect(enterClip?.value.crossfadeMs).toBeGreaterThan(0);
      expect(enterClip?.value.overlay).toBeUndefined();
      expect(enterClip?.value.playback.rate).toBeLessThan(1);
    }

    expect(fromSide).toBeGreaterThan(0);
    expect(fromBack).toBeGreaterThan(0);
    expect(fromSide).toBeLessThanOrEqual(2);

    const kneeler = places.find((place) => place.kneels);
    const kneelClips = scene.tracks.find(
      (track) => track.kind === "clip" && track.target === kneeler?.member.slug,
    );
    expect(kneelClips?.kind).toBe("clip");
    if (kneelClips?.kind !== "clip") return;
    expect(
      kneelClips.keyframes.some(
        (keyframe) => keyframe.value.animationGroup === "KneelLoop",
      ),
    ).toBe(true);
  });

  test("back entrances arrive by teleport and show up under its flash", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const scene = buildLineupScene(members);
    const entrances = planLineupEntrances(places);

    for (const [index, place] of places.entries()) {
      const entrance = entrances[index];
      const teleport = scene.tracks.find(
        (track) =>
          track.kind === "teleport" && track.target === place.member.slug,
      );
      const visibility = scene.tracks.find(
        (track) =>
          track.kind === "visibility" && track.target === place.member.slug,
      );
      expect(teleport !== undefined).toBe(entrance?.side === "back");
      expect(visibility?.keyframes[1]?.timeMs).toBe(entrance?.appearAt);
      if (teleport?.kind !== "teleport" || !entrance) continue;

      const [charge, done] = teleport.keyframes;
      expect(charge?.value.position).toEqual(entrance.start);
      const flashAt =
        (charge?.timeMs ?? 0) +
        ((done?.timeMs ?? 0) - (charge?.timeMs ?? 0)) * teleportFlashProgress;
      expect(flashAt).toBeCloseTo(entrance.appearAt);
      expect(entrance.appearAt).toBeLessThan(entrance.enterAt);
      expect(charge?.timeMs).toBeGreaterThanOrEqual(0);
    }
  });

  test("the troop marches in one after another", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const starts = planLineupEntrances(arrangeTroop(members))
      .map((entrance) => entrance.enterAt)
      .sort((left, right) => left - right);
    for (let index = 1; index < starts.length; index += 1)
      expect(
        (starts[index] ?? 0) - (starts[index - 1] ?? 0),
      ).toBeGreaterThanOrEqual(900);
  });

  test("does not branch on character identity", () => {
    const source = readFileSync(
      join(import.meta.dirname, "build-lineup-scene.ts"),
      "utf8",
    );
    const troop = readFileSync(
      join(import.meta.dirname, "arrange-troop.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/member\.name\s*===/);
    expect(source).not.toMatch(/if\s*\(\s*member\.slug/);
    expect(troop).not.toMatch(/member\.name\s*===/);
    expect(troop).not.toMatch(/if\s*\(\s*member\.slug/);
  });
});
