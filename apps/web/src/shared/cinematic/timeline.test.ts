import { describe, expect, test } from "vitest";
import { SceneClock } from "./clock.js";
import { TrackEvaluatorRegistry, type TimelineTrack } from "./evaluators.js";
import { SceneStateMachine } from "./state-machine.js";
import {
  compileTimeline,
  compileTracks,
  type CinematicFrame,
} from "./timeline.js";

const vec = (x: number, y: number, z: number) => ({ x, y, z });
const keyframes = <T>(first: T, middle: T) => [
  { timeMs: 0, value: first },
  { timeMs: 500, value: middle, easing: "linear" },
  { timeMs: 1000, value: first },
];

const scene = (loop = true) => ({
  id: "test-scene",
  schemaVersion: 1,
  durationMs: 1000,
  loop,
  declarations: [
    {
      kind: "actor",
      id: "actor",
      manifest: "manifest.json",
      character: "character.json",
    },
    { kind: "asset", id: "camera", asset: "camera" },
    { kind: "asset", id: "light", asset: "light" },
    { kind: "asset", id: "overlay", asset: "overlay" },
    { kind: "asset", id: "particles", asset: "particles" },
    { kind: "asset", id: "smoke", asset: "smoke" },
    { kind: "asset", id: "sound", asset: "sound" },
  ],
  markers: [
    { id: "intro", timeMs: 0 },
    { id: "reveal", timeMs: 500 },
  ],
  phases: [],
  tracks: [
    {
      kind: "clip",
      id: "clips",
      target: "actor",
      keyframes: keyframes(
        {
          animationGroup: "stand",
          id: "stand-0",
          crossfadeMs: 0,
          playback: { rate: 1, loop: true, clampWhenFinished: false },
        },
        {
          animationGroup: "attack",
          id: "attack-0",
          crossfadeMs: 100,
          playback: { rate: 2, loop: false, clampWhenFinished: true },
        },
      ),
    },
    {
      kind: "transform",
      id: "transform",
      target: "actor",
      keyframes: keyframes(
        {
          position: vec(0, 0, 0),
          rotation: vec(0, 0, 0),
          scale: vec(1, 1, 1),
        },
        {
          position: vec(10, 5, 0),
          rotation: vec(0, 1, 0),
          scale: vec(2, 2, 2),
        },
      ),
    },
    {
      kind: "camera",
      id: "camera-track",
      target: "camera",
      keyframes: keyframes(
        { position: vec(0, 1, 5), target: vec(0, 1, 0), fov: 45 },
        { position: vec(0, 2, 3), target: vec(0, 2, 0), fov: 60 },
      ),
    },
    {
      kind: "light",
      id: "light-track",
      target: "light",
      keyframes: keyframes(
        { position: vec(0, 2, 0), color: "#000000", intensity: 0 },
        { position: vec(1, 3, 1), color: "#ffffff", intensity: 10 },
      ),
    },
    {
      kind: "visibility",
      id: "visible",
      target: "actor",
      keyframes: keyframes(true, false),
    },
    {
      kind: "ui",
      id: "ui-track",
      target: "overlay",
      keyframes: keyframes(
        { opacity: 0, translation: vec(0, 0, 0), scale: 1, blur: 0 },
        { opacity: 1, translation: vec(10, 0, 0), scale: 2, blur: 4 },
      ),
    },
    {
      kind: "emitter",
      id: "emitter-track",
      target: "particles",
      seed: 123,
      keyframes: keyframes(
        { rate: 0, lifetimeMs: 100, velocity: vec(0, 1, 0), spread: 0 },
        { rate: 10, lifetimeMs: 500, velocity: vec(1, 2, 0), spread: 90 },
      ),
    },
    {
      kind: "smoke",
      id: "smoke-track",
      target: "smoke",
      seed: 456,
      keyframes: keyframes(
        { density: 0, drift: vec(0, 0, 0), size: 0, opacity: 0 },
        { density: 1, drift: vec(1, 0, 0), size: 4, opacity: 1 },
      ),
    },
    {
      kind: "audio",
      id: "audio-track",
      target: "sound",
      keyframes: [
        {
          timeMs: 125,
          value: { asset: "intro.ogg", cue: "intro", gain: 0.5 },
        },
        {
          timeMs: 750,
          value: { asset: "hit.ogg", cue: "hit", gain: 1 },
        },
      ],
    },
  ],
});

const comparable = (frame: CinematicFrame) => ({
  ...frame,
  elapsedMs: 0,
  iteration: 0,
});

describe("SceneClock", () => {
  test("defines exact terminal, loop, negative, and large-seek boundaries", () => {
    const terminal = new SceneClock({ durationMs: 1000, loop: false });
    expect(terminal.seek(1000)).toMatchObject({ timeMs: 1000, atEnd: true });
    expect(terminal.seek(-5)).toMatchObject({ timeMs: 0, atEnd: false });
    expect(terminal.seek(1e12)).toMatchObject({ timeMs: 1000, atEnd: true });

    const loop = new SceneClock({ durationMs: 1000, loop: true });
    expect(loop.seek(1000)).toMatchObject({ timeMs: 0, iteration: 1 });
    expect(loop.seek(-1)).toMatchObject({ timeMs: 999, iteration: -1 });
    expect(loop.seek(1_000_000_000_125)).toMatchObject({
      timeMs: 125,
      iteration: 1_000_000_000,
    });
  });

  test("keeps one absolute origin across hundreds of loops without drift", () => {
    const clock = new SceneClock({ durationMs: 37.5, loop: true });
    clock.play();
    for (let index = 0; index < 10_000; index += 1) clock.tick(3.75);
    expect(clock.time).toMatchObject({ timeMs: 0, iteration: 1000 });
    expect(clock.time).toEqual(clock.seek(37_500));
    expect(clock.reset()).toMatchObject({
      timeMs: 0,
      elapsedMs: 0,
      iteration: 0,
    });

    const fractional = new SceneClock({ durationMs: 1, loop: true });
    fractional.play();
    for (let index = 0; index < 10_000; index += 1) fractional.tick(0.1);
    expect(fractional.time).toMatchObject({ timeMs: 0, iteration: 1000 });
  });
});

describe("scene phases", () => {
  test("uses explicit left-closed phases and deterministic gaps", () => {
    const phases = new SceneStateMachine(
      [{ id: "ignored-marker", timeMs: 0 }],
      1000,
      [
        { id: "approach", startMs: 100, endMs: 300 },
        { id: "finale", startMs: 500, endMs: 1000 },
      ],
    );

    expect(phases.phaseAt(0)).toEqual({
      id: "initial",
      index: -1,
      startMs: 0,
      endMs: 100,
      progress: 0,
    });
    expect(phases.phaseAt(100)).toMatchObject({
      id: "approach",
      index: 0,
      progress: 0,
    });
    expect(phases.phaseAt(300)).toEqual({
      id: "gap",
      index: -1,
      startMs: 300,
      endMs: 500,
      progress: 0,
    });
    expect(phases.phaseAt(400)).toMatchObject({
      id: "gap",
      progress: 0.5,
    });
    expect(phases.phaseAt(500)).toMatchObject({
      id: "finale",
      index: 1,
      progress: 0,
    });
    expect(phases.phaseAt(1000)).toEqual({
      id: "finale",
      index: 1,
      startMs: 500,
      endMs: 1000,
      progress: 1,
    });
  });

  test("falls back to marker-derived phases when none are authored", () => {
    const phases = new SceneStateMachine(
      [
        { id: "intro", timeMs: 0 },
        { id: "reveal", timeMs: 500 },
      ],
      1000,
    );
    expect(phases.phaseAt(499).id).toBe("intro");
    expect(phases.phaseAt(500)).toMatchObject({
      id: "reveal",
      progress: 0,
    });
    expect(phases.phaseAt(1000)).toMatchObject({
      id: "reveal",
      progress: 1,
    });
  });
});

describe("compiled timeline", () => {
  test("passes authoritative explicit phases into frame evaluation", () => {
    const timeline = compileTimeline({
      ...scene(false),
      phases: [
        { id: "approach", startMs: 100, endMs: 300 },
        { id: "finale", startMs: 500, endMs: 1000 },
      ],
    });

    expect(timeline.seek(0).phase.id).toBe("initial");
    expect(timeline.seek(300).phase.id).toBe("gap");
    expect(timeline.seek(500).phase.id).toBe("finale");
    expect(timeline.poster().phase).toMatchObject({
      id: "finale",
      progress: 1,
    });
  });

  test("makes direct seek identical to incremental absolute ticks", () => {
    const direct = compileTimeline(scene());
    const incremental = compileTimeline(scene());
    incremental.play();
    let elapsed = 0;
    for (let index = 0; index < 307; index += 1) {
      elapsed += 7.25;
      incremental.tick(7.25);
    }
    expect(comparable(incremental.pause())).toEqual(
      comparable(direct.seek(elapsed)),
    );
  });

  test("has deterministic clip/marker boundaries and exact reset", () => {
    const timeline = compileTimeline(scene());
    const before = timeline.seek(499.999);
    const boundary = timeline.seek(500);
    const clipBefore = before.commands.find(({ kind }) => kind === "clip");
    const clipBoundary = boundary.commands.find(({ kind }) => kind === "clip");
    expect(clipBefore?.value).toMatchObject({
      animationGroup: "stand",
      localTimeMs: 499.999,
    });
    expect(clipBoundary?.value).toMatchObject({
      animationGroup: "attack",
      localTimeMs: 0,
      crossfadeMs: 100,
    });
    expect(boundary.phase.id).toBe("reveal");

    const initial = timeline.evaluate(0);
    timeline.play();
    timeline.tick(876);
    expect(timeline.reset()).toEqual(initial);
  });

  test("repeats the same immutable state after hundreds of loops", () => {
    const timeline = compileTimeline(scene());
    const first = timeline.seek(250);
    const repeated = timeline.seek(800_250);
    expect(comparable(repeated)).toEqual(comparable(first));
    expect(repeated.iteration).toBe(800);
    expect(Object.isFrozen(repeated)).toBe(true);
    expect(Object.isFrozen(repeated.commands)).toBe(true);
    expect(Object.isFrozen(repeated.commands[0]?.value)).toBe(true);
  });

  test("evaluates the reduced-motion poster without wrapping", () => {
    const timeline = compileTimeline(scene());
    expect(timeline.seek(1000).timeMs).toBe(0);
    expect(timeline.poster().timeMs).toBe(1000);
    expect(timeline.poster(-20).timeMs).toBe(0);
    expect(timeline.poster(5000).timeMs).toBe(1000);
  });

  test("identifies audio cues deterministically without playback", () => {
    const direct = compileTimeline(scene()).seek(750);
    const ticked = compileTimeline(scene());
    ticked.play();
    for (let index = 0; index < 30; index += 1) ticked.tick(25);
    expect(ticked.pause().audioCues).toEqual(direct.audioCues);
    expect(direct.audioCues.map(({ cue }) => cue)).toEqual(["intro", "hit"]);
    expect(compileTimeline(scene()).seek(124).audioCues).toEqual([]);
  });

  test("interpolates scalar/vector values and steps visibility", () => {
    const frame = compileTimeline(scene()).seek(250);
    expect(
      frame.commands.find(({ kind }) => kind === "transform")?.value,
    ).toMatchObject({ position: { x: 5, y: 2.5, z: 0 } });
    expect(
      frame.commands.find(({ kind }) => kind === "visibility")?.value,
    ).toBe(true);
    expect(
      frame.commands.find(({ kind }) => kind === "emitter")?.value,
    ).toMatchObject({ rate: 5, velocity: { x: 0.5, y: 1.5, z: 0 } });
  });
});

test("a synthetic evaluator extends the registry without changing the loop", () => {
  const registry = new TrackEvaluatorRegistry().register(
    "synthetic",
    (track) => ({
      kind: track.kind,
      id: track.id,
      evaluate: (timeMs) => ({
        command: Object.freeze({
          kind: track.kind,
          trackId: track.id,
          target: track.target,
          value: timeMs * 2,
        }),
      }),
      reset() {},
    }),
  );
  const track: TimelineTrack = {
    kind: "synthetic",
    id: "custom",
    target: "target",
    keyframes: [{ timeMs: 0, value: 0 }],
  };
  expect(compileTracks([track], registry)[0]?.evaluate(12).command?.value).toBe(
    24,
  );
});
