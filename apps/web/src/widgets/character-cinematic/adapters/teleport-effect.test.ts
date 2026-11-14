import { teleportFlashProgress } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";

import { TeleportEffect, teleportEnvelope } from "./teleport-effect";

const values = (progress: number) => ({
  position: { x: 1, y: 0, z: -2 },
  progress,
  tint: { x: 0.4, y: 0.6, z: 1 },
});

describe("teleportEnvelope", () => {
  it("is dark before and after the arrival and flashes at its peak", () => {
    expect(teleportEnvelope(0)).toMatchObject({ beam: 0, flash: 0, sparks: 0 });
    expect(teleportEnvelope(1)).toMatchObject({ beam: 0, flash: 0, sparks: 0 });
    expect(teleportEnvelope(teleportFlashProgress).flash).toBeCloseTo(1);
    expect(teleportEnvelope(teleportFlashProgress).beam).toBeCloseTo(1);
    expect(teleportEnvelope(0.2).flash).toBe(0);
  });

  it("grows the column while charging", () => {
    expect(teleportEnvelope(0.1).beamHeight).toBeLessThan(
      teleportEnvelope(0.4).beamHeight,
    );
  });
});

describe("TeleportEffect", () => {
  it("only shows while the arrival runs, where the track places it", () => {
    const effect = new TeleportEffect(7);
    effect.apply(values(0), 0);
    expect(effect.root.visible).toBe(false);
    effect.apply(values(0.5), 600);
    expect(effect.root.visible).toBe(true);
    expect(effect.root.position.toArray()).toEqual([1, 0, -2]);
    effect.apply(values(1), 1500);
    expect(effect.root.visible).toBe(false);
    effect.dispose();
  });
});
