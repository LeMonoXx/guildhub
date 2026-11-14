import { describe, expect, test } from "vitest";
import {
  buildCharacterIdleScene,
  bustCamera,
  idleCamera,
} from "./build-idle-scene";

describe("buildCharacterIdleScene", () => {
  test("stands one actor in their own look, not the rogue proof", () => {
    const scene = buildCharacterIdleScene({
      id: "memento-mori",
      manifest: "/assets/looks/3a60fc66726efe27/look.json",
      figureHeight: 1.65,
    });
    const actor = scene.declarations.find(
      (declaration) => declaration.kind === "actor",
    );
    expect(scene.id).toBe("character-idle");
    expect(actor).toMatchObject({
      id: "memento-mori",
      manifest: "/assets/looks/3a60fc66726efe27/look.json",
    });
    expect(scene.tracks.some((track) => track.kind === "smoke")).toBe(false);
    const clip = scene.tracks.find((track) => track.kind === "clip");
    expect(clip?.kind).toBe("clip");
    if (clip?.kind !== "clip") return;
    expect(clip.target).toBe("memento-mori");
    expect(
      clip.keyframes.every(
        (keyframe) => keyframe.value.animationGroup === "Stand",
      ),
    ).toBe(true);
  });

  test("frames the whole figure, feet to crown, for small and tall races", () => {
    for (const figureHeight of [1.05, 2.25]) {
      const camera = idleCamera(figureHeight);
      const distance = camera.position.z - camera.target.z;
      const halfView = Math.tan(((camera.fov / 2) * Math.PI) / 180) * distance;
      const crown = figureHeight * 1.2;
      expect(camera.target.y - halfView).toBeLessThan(0);
      expect(camera.target.y + halfView).toBeGreaterThan(crown);
      expect(camera.target.y + halfView).toBeLessThan(crown * 1.25);
    }
  });

  test("frames from the belt up when asked for a bust", () => {
    for (const figureHeight of [1.05, 2.25]) {
      const camera = bustCamera(figureHeight);
      const distance = camera.position.z - camera.target.z;
      const halfView = Math.tan(((camera.fov / 2) * Math.PI) / 180) * distance;
      const height = figureHeight * 1.2;
      expect(camera.target.y - halfView).toBeCloseTo(height * 0.48);
      expect(camera.target.y + halfView).toBeGreaterThan(height);
    }
    const scene = buildCharacterIdleScene({
      id: "memento-mori",
      manifest: "/assets/looks/3a60fc66726efe27/look.json",
      figureHeight: 1.65,
      framing: "bust",
    });
    const cameraTrack = scene.tracks.find((track) => track.kind === "camera");
    expect(
      cameraTrack?.kind === "camera" && cameraTrack.keyframes[0]?.value,
    ).toEqual(bustCamera(1.65));
  });
});
