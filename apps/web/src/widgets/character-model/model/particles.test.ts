import { describe, expect, test } from "vitest";
import type { ParticleEmitterMeta } from "../../../types";
import {
  MAX_PARTICLES,
  advance,
  appearance,
  createState,
  rng,
  sampleCurve,
  sampleTrack,
  simulateTo,
  spawn,
} from "./particles";

const constant = (...values: number[]) => ({
  durationMs: 1000,
  interpolation: 1,
  keys: [[0, ...values]],
});
const glow = (
  over: Partial<ParticleEmitterMeta> = {},
): ParticleEmitterMeta => ({
  index: 0,
  flags: 0,
  bone: 1,
  boneNode: "bone_1",
  offsetGltf: [0, 0, 0],
  textureIndex: 1,
  textureFileDataId: 203839,
  blendMode: 4,
  emitterType: 1,
  rows: 1,
  columns: 1,
  tracks: {
    emissionSpeed: constant(0.2),
    speedVariation: constant(0),
    verticalRange: constant(0),
    horizontalRange: constant(Math.PI * 2),
    lifespan: constant(1.25),
    emissionRate: constant(8),
    areaX: constant(0.2),
    areaY: constant(0.1),
  },
  lifespanVariation: 0,
  emissionRateVariation: 0,
  color: {
    times: [0, 0.5, 1],
    values: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  },
  alpha: { times: [0, 0.5, 1], values: [0, 1, 0] },
  scale: {
    times: [0, 1],
    values: [
      [0.1, 0.1],
      [0.3, 0.3],
    ],
  },
  scaleVariation: [0, 0],
  drag: 0,
  ...over,
});

describe("particle tracks and curves", () => {
  test("interpolates and loops tracks", () => {
    const track = {
      durationMs: 1000,
      interpolation: 1,
      keys: [
        [0, 10],
        [500, 20],
      ],
    };
    expect(sampleTrack(track, 250, [0])).toEqual([15]);
    expect(sampleTrack(track, 1250, [0])).toEqual([15]);
    expect(sampleTrack(track, 750, [0])).toEqual([20]);
  });

  test("interpolates lifetime curves", () => {
    expect(sampleCurve(glow().color, 0.25, [1, 1, 1])).toEqual([0.5, 0.5, 0]);
  });
});

describe("particle simulation", () => {
  test("spawns plane particles in the requested area", () => {
    const random = rng(1);
    for (let index = 0; index < 25; index += 1) {
      const particle = spawn(glow(), 0, random);
      expect(Math.abs(particle.pos[0] ?? 0)).toBeLessThanOrEqual(0.1);
      expect(particle.pos[1]).toBe(0);
      expect(Math.abs(particle.pos[2] ?? 0)).toBeLessThanOrEqual(0.05);
    }
  });

  test("emits, expires, and caps particles", () => {
    const state = createState(glow(), 3);
    for (let index = 0; index < 30; index += 1) advance(state, 1 / 30);
    expect(state.particles).toHaveLength(8);
    const crowded = createState(
      glow({
        tracks: {
          ...glow().tracks,
          emissionRate: constant(10_000),
          lifespan: constant(10),
        },
      }),
      5,
    );
    advance(crowded, 1);
    expect(crowded.particles).toHaveLength(MAX_PARTICLES);
  });

  test("is repeatable and follows appearance curves", () => {
    expect(simulateTo(glow(), 9, 2.5).particles).toEqual(
      simulateTo(glow(), 9, 2.5).particles,
    );
    const result = appearance(glow(), {
      pos: [0, 0, 0],
      vel: [0, 0, 0],
      age: 0.625,
      life: 1.25,
      sizeFactor: 1,
    });
    expect(result.color).toEqual([0, 1, 0]);
    expect(result.alpha).toBe(1);
  });
});
