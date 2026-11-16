import { describe, expect, test } from "vitest";
import type { ParticleEmitterMeta } from "./types";
import { createParticleMesh } from "./particle-mesh";

const constant = (...values: number[]) => ({
  durationMs: 1000,
  interpolation: 1,
  keys: [[0, ...values]],
});

const emitter: ParticleEmitterMeta = {
  index: 0,
  flags: 0,
  bone: 0,
  boneNode: null,
  offsetGltf: [0, 0, 0],
  textureIndex: 0,
  textureFileDataId: null,
  blendMode: 4,
  emitterType: 1,
  rows: 1,
  columns: 1,
  tracks: {
    emissionSpeed: constant(0.2),
    lifespan: constant(2),
    emissionRate: constant(8),
    areaX: constant(0.1),
    areaY: constant(0.1),
  },
  lifespanVariation: 0,
  emissionRateVariation: 0,
  scaleVariation: [0, 0],
  drag: 0,
};

describe("particle lifecycle", () => {
  test("reset reproduces the initial deterministic state", () => {
    const particle = createParticleMesh(emitter, null, 12);
    particle.setTime(1);
    const atOne = Array.from(
      particle.object.geometry.getAttribute("position").array,
    );
    particle.reset();
    expect(particle.object.geometry.drawRange.count).toBe(0);
    particle.setTime(1);
    expect(
      Array.from(particle.object.geometry.getAttribute("position").array),
    ).toEqual(atOne);
    particle.dispose();
    particle.dispose();
  });
});
