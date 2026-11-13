import { describe, expect, test, vi } from "vitest";
import { SmokeEffect } from "./smoke-effect";

const values = {
  density: 0.65,
  drift: { x: 0.4, y: 0.2, z: -0.1 },
  size: 18,
  opacity: 0.8,
};

const buffers = (effect: SmokeEffect) => ({
  positions: [...effect.positionAttribute.array],
  opacities: [...effect.opacityAttribute.array],
  sizes: [...effect.sizeAttribute.array],
  drawCount: effect.geometry.drawRange.count,
});

describe("SmokeEffect", () => {
  test("reproduces an identical seeded frame after seek and reset", () => {
    const first = new SmokeEffect(1234, 32);
    const second = new SmokeEffect(1234, 32);
    first.apply(values, 1750);
    second.apply(values, 1750);
    const expected = buffers(first);
    expect(buffers(second)).toEqual(expected);

    first.setTime(9000);
    first.reset();
    first.setTime(1750);
    expect(buffers(first)).toEqual(expected);
    first.dispose();
    second.dispose();
  });

  test("retains GPU resource and attribute identity across reset and loops", () => {
    const effect = new SmokeEffect(99, 16);
    expect(effect.points.frustumCulled).toBe(false);
    const resources = {
      geometry: effect.geometry,
      material: effect.material,
      position: effect.positionAttribute,
      opacity: effect.opacityAttribute,
      size: effect.sizeAttribute,
      seed: effect.seedAttribute,
    };
    effect.apply(values, 1000);
    effect.reset();
    effect.apply(values, 1000);
    expect(effect.geometry).toBe(resources.geometry);
    expect(effect.material).toBe(resources.material);
    expect(effect.positionAttribute).toBe(resources.position);
    expect(effect.opacityAttribute).toBe(resources.opacity);
    expect(effect.sizeAttribute).toBe(resources.size);
    expect(effect.seedAttribute).toBe(resources.seed);
    effect.dispose();
  });

  test("keeps the dense cloud low around the character", () => {
    const effect = new SmokeEffect(424242, 256);
    effect.apply(
      {
        density: 1,
        drift: { x: 0, y: 0, z: 0 },
        size: 64,
        opacity: 1,
      },
      0,
    );
    const positions = effect.positionAttribute.array as Float32Array;
    const yPositions = Array.from(
      { length: effect.capacity },
      (_, index) => positions[index * 3 + 1] ?? 0,
    );

    expect(Math.min(...yPositions)).toBeLessThan(0);
    expect(Math.max(...yPositions)).toBeLessThan(1.96);
    effect.dispose();
  });

  test("disposes resources once", () => {
    const effect = new SmokeEffect(1, 4);
    const geometry = vi.spyOn(effect.geometry, "dispose");
    const material = vi.spyOn(effect.material, "dispose");
    effect.dispose();
    effect.dispose();
    expect(geometry).toHaveBeenCalledTimes(1);
    expect(material).toHaveBeenCalledTimes(1);
  });
});
