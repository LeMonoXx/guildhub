import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { createFixtureGuildSource } from "../../../entities/guild";
import { arrangeTroop } from "./arrange-troop";
import {
  approachSides,
  approachStart,
  buildLineupScene,
  facingToward,
  laneBySide,
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

  test("sorts the troop by stature with one kneel only in front of a large race", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const xs = places.map((place) => place.slot.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(6);

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

  test("walks actors in slowly from the sides and the back with a locomotion overlay", async () => {
    const members = (await createFixtureGuildSource().getFeaturedMembers())
      .members;
    const places = arrangeTroop(members);
    const scene = buildLineupScene(members);
    const locomotion = new Set(["Walk", "StealthWalk"]);
    const sides = approachSides(places);
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
      const side = sides[index] ?? "back";
      const lane = laneBySide(sides, index);
      expect(start).toEqual(approachStart(place.slot, side, lane));
      expect(start?.y).toBe(0);
      if (side === "back") fromBack += 1;
      else fromSide += 1;

      const enterAt = transform.keyframes[1]?.timeMs ?? 0;
      const settledAt = transform.keyframes[2]?.timeMs ?? 0;
      expect(enterAt).toBe(40 + index * 500);
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

      const enterClip = clips.keyframes[0]?.value;
      expect(locomotion.has(enterClip?.animationGroup ?? "")).toBe(true);
      expect(enterClip?.overlay).toBeUndefined();
      expect(enterClip?.playback.rate).toBeLessThan(1);
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
