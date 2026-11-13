import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  cinematicSceneSchema,
  type CinematicScene,
  type CinematicTrack,
} from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { compileTimeline, type CinematicFrame } from "./timeline.js";

const scenePath = join(
  import.meta.dirname,
  "../../test-fixtures/cinematics/rogue-proof.scene.json",
);

const loadScene = (): CinematicScene =>
  cinematicSceneSchema.parse(JSON.parse(readFileSync(scenePath, "utf8")));

const command = (frame: CinematicFrame, kind: CinematicTrack["kind"]) =>
  frame.commands.find((candidate) => candidate.kind === kind);

describe("rogue proof scene", () => {
  test("is a strict schema-version 1 scene with supported host targets", () => {
    const scene = loadScene();
    const declarations = new Set(
      scene.declarations.map((declaration) => declaration.id),
    );

    expect(scene.schemaVersion).toBe(1);
    expect(scene.loop).toBe(true);
    expect(scene.tracks.some((track) => track.kind === "emitter")).toBe(false);
    expect(scene.tracks.some((track) => track.kind === "audio")).toBe(false);
    for (const track of scene.tracks)
      expect(declarations.has(track.target), track.id).toBe(true);
  });

  test("samples a continuous approach, smoke, vanish, endpoint, and reset", () => {
    const timeline = compileTimeline(loadScene());
    const initial = timeline.evaluate(0);
    const runIn = timeline.evaluate(1600);
    const beforeThrow = timeline.evaluate(3950);
    const throwing = timeline.evaluate(4200);
    const smoke = timeline.evaluate(4700);
    const covered = timeline.evaluate(5599);
    const vanished = timeline.evaluate(5600);
    const endpoint = timeline.poster(timeline.scene.durationMs);

    expect(initial.phase.id).toBe("prewarm");
    expect(command(initial, "visibility")?.value).toBe(false);
    expect(command(initial, "ui")?.value).toMatchObject({
      opacity: 0,
      blur: 5,
    });

    expect(runIn.phase.id).toBe("approach");
    expect(command(runIn, "clip")?.value).toMatchObject({
      animationGroup: "Run",
    });
    expect(command(runIn, "visibility")?.value).toBe(true);
    const approach = command(runIn, "transform")?.value as {
      position: { x: number };
      scale: { x: number };
    };
    expect(approach.position.x).toBeLessThan(-5);
    expect(approach.scale.x).toBeLessThan(0.5);

    expect(command(throwing, "clip")?.value).toMatchObject({
      animationGroup: "Run",
      overlay: {
        id: "throw",
        animationGroup: "UseStandingStart",
        mask: "upper-body",
      },
    });
    const beforeThrowTransform = command(beforeThrow, "transform")?.value as {
      position: { x: number };
    };
    const throwingTransform = command(throwing, "transform")?.value as {
      position: { x: number };
    };
    expect(throwingTransform.position.x).toBeGreaterThan(
      beforeThrowTransform.position.x,
    );

    expect(smoke.phase.id).toBe("smoke");
    expect(command(smoke, "smoke")?.value).toMatchObject({
      density: 0.7,
      size: 34,
      opacity: 0.9,
    });
    expect(command(smoke, "clip")?.value).toMatchObject({
      animationGroup: "Run",
    });

    expect(command(covered, "visibility")?.value).toBe(true);
    expect(command(covered, "smoke")?.value).toMatchObject({
      density: 1,
      opacity: 1,
    });

    expect(vanished.phase.id).toBe("vanish");
    expect(command(vanished, "visibility")?.value).toBe(false);
    const vanishedSmoke = command(vanished, "smoke")?.value as {
      density: number;
      opacity: number;
    };
    expect(vanishedSmoke.density).toBe(1);
    expect(vanishedSmoke.opacity).toBe(1);

    expect(endpoint.commands).toEqual(initial.commands);
    timeline.play();
    timeline.tick(5375);
    expect(timeline.reset()).toEqual(initial);
  });

  test("uses a stable visible approach frame for reduced motion", () => {
    const poster = compileTimeline(loadScene()).poster(3800);

    expect(poster.phase.id).toBe("approach");
    expect(command(poster, "visibility")?.value).toBe(true);
    expect(command(poster, "clip")?.value).toMatchObject({
      animationGroup: "Run",
    });
    expect(command(poster, "smoke")?.value).toMatchObject({
      density: 0,
      opacity: 0,
    });
  });
});
