import * as THREE from "three";
import { describe, expect, test } from "vitest";
import type { ParticleEmitterMeta } from "../types";
import { createParticleMesh } from "./particle-mesh";
import { simulateTo } from "./particles";

const constant = (...values: number[]) => ({
  durationMs: 1000,
  interpolation: 1,
  keys: [[0, ...values]],
});
const emitter = (blendMode = 4): ParticleEmitterMeta => ({
  index: 0,
  flags: 0,
  bone: 1,
  boneNode: "bone_1",
  offsetGltf: [0, 0.1, 0],
  textureIndex: 1,
  textureFileDataId: null,
  blendMode,
  emitterType: 1,
  rows: 2,
  columns: 2,
  tracks: {
    emissionSpeed: constant(0.2),
    lifespan: constant(1.25),
    emissionRate: constant(8),
    areaX: constant(0.1),
    areaY: constant(0.1),
  },
  lifespanVariation: 0,
  emissionRateVariation: 0,
  scaleVariation: [0, 0],
  drag: 0,
  alpha: { times: [0, 1], values: [1, 0] },
});

describe("particle mesh", () => {
  test("draws deterministic particle positions", () => {
    const mesh = createParticleMesh(emitter(), null, 7);
    mesh.setTime(2);
    const expected = simulateTo(emitter(), 7, 2).particles;
    expect(mesh.object.geometry.drawRange.count).toBe(expected.length);
    expect(
      Array.from(
        mesh.object.geometry.getAttribute("position").array.slice(0, 3),
      ),
    ).toEqual(expected[0]?.pos.map(Math.fround));
    mesh.dispose();
  });

  test("uses the M2 additive blend state", () => {
    const material = createParticleMesh(emitter(), null, 1).object.material;
    expect(material.blending).toBe(THREE.CustomBlending);
    expect(material.blendDst).toBe(THREE.OneFactor);
    expect(material.depthWrite).toBe(false);
  });
});
