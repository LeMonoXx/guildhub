import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import type { CinematicFrame, FrameCommand } from "../../../cinematic";
import type { CharacterHandle } from "../../character-model";
import {
  AnimationDirector,
  AudioBindingState,
  type BindingContext,
  BindingRegistry,
  BindingTargetRegistry,
  ClipBinding,
  createDefaultBindings,
  type CameraBindingTarget,
  type UiBindingState,
} from "./animation-director";

const frame = (
  commands: readonly FrameCommand[],
  iteration = 0,
  elapsedMs = 250,
): CinematicFrame => ({
  timeMs: elapsedMs,
  elapsedMs,
  iteration,
  atEnd: false,
  phase: {
    id: "test",
    index: 0,
    startMs: 0,
    endMs: 1000,
    progress: 0.25,
  },
  commands,
  audioCues: [],
});

const command = (
  kind: string,
  target: string,
  value: unknown,
): FrameCommand => ({ kind, trackId: `${kind}-track`, target, value });

describe("AnimationDirector", () => {
  test("dispatches by registered kind and accepts extensions", () => {
    const apply =
      vi.fn<
        (
          target: unknown,
          command: FrameCommand,
          context: BindingContext,
        ) => void
      >();
    const bindings = new BindingRegistry().register("custom", { apply });
    const targets = new BindingTargetRegistry().register(
      "custom",
      "target",
      42,
    );
    new AnimationDirector(bindings, targets).apply(
      frame([command("custom", "target", "value")]),
    );
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toBe(42);
    expect(apply.mock.calls[0]?.[1]).toMatchObject({ value: "value" });
    expect(apply.mock.calls[0]?.[2].frame.timeMs).toBe(250);
  });

  test("seeks once, then advances clips and crossfades incrementally", () => {
    const selectAnimationGroup = vi.fn(() => true);
    const setTime = vi.fn();
    const update = vi.fn();
    const character = {
      selectAnimationGroup,
      setTime,
      update,
    } as unknown as CharacterHandle;
    const binding = new ClipBinding();
    const stand = command("clip", "actor", {
      animationGroup: "stand",
      crossfadeMs: 200,
      localTimeMs: 500,
    });
    const firstFrame = frame([stand], 0, 500);
    binding.apply(character, stand, {
      frame: firstFrame,
      report: vi.fn(),
    });
    const nextStand = command("clip", "actor", {
      animationGroup: "stand",
      crossfadeMs: 200,
      localTimeMs: 516,
    });
    binding.apply(character, nextStand, {
      frame: frame([nextStand], 0, 516),
      report: vi.fn(),
    });
    const run = command("clip", "actor", {
      animationGroup: "run",
      crossfadeMs: 100,
      localTimeMs: 10,
    });
    binding.apply(character, run, {
      frame: frame([run], 0, 526),
      report: vi.fn(),
    });

    expect(selectAnimationGroup).toHaveBeenCalledTimes(2);
    expect(selectAnimationGroup).toHaveBeenNthCalledWith(1, "stand", 0.2);
    expect(setTime).toHaveBeenNthCalledWith(1, 0.5);
    expect(setTime).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenNthCalledWith(1, 0.016);
    expect(update).toHaveBeenNthCalledWith(2, 0.01);
  });

  test("applies camera, light, and UI values", () => {
    const setCamera = vi.fn();
    const camera: CameraBindingTarget = { setCamera };
    const light = new THREE.DirectionalLight();
    const setState = vi.fn<(state: UiBindingState) => void>();
    const targets = new BindingTargetRegistry()
      .register("camera", "camera", camera)
      .register("light", "key", light)
      .register("ui", "overlay", { setState });
    const ui = {
      opacity: 0.75,
      translation: { x: 1, y: 2, z: 3 },
      scale: 1.2,
      blur: 4,
    };
    new AnimationDirector(createDefaultBindings(), targets).apply(
      frame([
        command("camera", "camera", {
          position: { x: 1, y: 2, z: 3 },
          target: { x: 0, y: 1, z: 0 },
          fov: 52,
        }),
        command("light", "key", {
          position: { x: 4, y: 5, z: 6 },
          color: "#123456",
          intensity: 8,
        }),
        command("ui", "overlay", ui),
      ]),
    );

    expect(setCamera).toHaveBeenCalledWith(
      { x: 1, y: 2, z: 3 },
      { x: 0, y: 1, z: 0 },
      52,
    );
    expect(light.position.toArray()).toEqual([4, 5, 6]);
    expect(light.color.getHexString()).toBe("123456");
    expect(light.intensity).toBe(8);
    expect(setState).toHaveBeenCalledWith(ui);
  });

  test("reports unknown kinds and targets explicitly", () => {
    const report = vi.fn();
    const director = new AnimationDirector(
      createDefaultBindings(),
      new BindingTargetRegistry(),
      report,
    );
    director.apply(
      frame([
        command("future", "thing", null),
        command("camera", "missing", null),
      ]),
    );
    expect(report).toHaveBeenCalledWith('Unknown binding kind "future"');
    expect(report).toHaveBeenCalledWith(
      'Unknown camera target "missing" for track "camera-track"',
    );
  });

  test("keeps silent audio cues deduplicated by iteration, track, and time", () => {
    const audio = new AudioBindingState();
    const targets = new BindingTargetRegistry().register(
      "audio",
      "sound",
      audio,
    );
    const director = new AnimationDirector(createDefaultBindings(), targets);
    const cue = {
      trackId: "audio-track",
      target: "sound",
      timeMs: 125,
      asset: "future.ogg",
      cue: "reveal",
      gain: 1,
    };
    const audioFrame = { ...frame([], 2), audioCues: [cue, cue] };
    director.apply(audioFrame);
    director.apply(audioFrame);
    expect(audio.cueIds).toEqual(["2:audio-track:125"]);
  });
});
