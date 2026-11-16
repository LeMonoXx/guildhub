import * as THREE from "three";
import { describe, expect, test } from "vitest";
import { loopTime, sequencePosition, type ClipAction } from "./clip-timing";

const clip = (name: string, duration: number): ClipAction => {
  const source = new THREE.AnimationClip(name, duration, []);
  return {
    name,
    clip: source,
    action: new THREE.AnimationMixer(new THREE.Object3D()).clipAction(source),
  };
};

describe("sequencePosition", () => {
  const clips = [clip("a", 1), clip("b", 2)];

  test("walks the clips back to back and loops the whole sequence", () => {
    expect(sequencePosition(clips, 0.5)).toEqual({ index: 0, local: 0.5 });
    expect(sequencePosition(clips, 1.5)).toEqual({ index: 1, local: 0.5 });
    expect(sequencePosition(clips, 3.25)).toEqual({ index: 0, local: 0.25 });
  });

  test("has no position without clips", () => {
    expect(sequencePosition([], 1)).toEqual({ index: -1, local: 0 });
  });
});

describe("loopTime", () => {
  test("wraps into one loop and never divides by zero", () => {
    expect(loopTime(2.5, clip("a", 1).clip)).toBeCloseTo(0.5);
    expect(Number.isFinite(loopTime(1, clip("z", 0).clip))).toBe(true);
  });
});
