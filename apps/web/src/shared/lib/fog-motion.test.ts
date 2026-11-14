import { describe, expect, test } from "vitest";
import type { FogFigure } from "./fog-channel";
import { FigureMotionTracker } from "./fog-motion";

const at = (x: number): FogFigure => ({
  id: "a",
  x,
  feet: 500,
  head: 200,
  halfWidth: 40,
});

describe("FigureMotionTracker", () => {
  test("eases toward the measured velocity instead of jumping", () => {
    const tracker = new FigureMotionTracker();
    tracker.update([at(0)], 0, 1 / 60);
    const [first] = tracker.update([at(10)], 100, 1 / 60);
    expect(first?.vx).toBeGreaterThan(0);
    expect(first?.vx).toBeLessThan(100);
  });

  test("keeps moving smoothly across frames that repeat a position", () => {
    const tracker = new FigureMotionTracker();
    tracker.update([at(0)], 0, 1 / 60);
    let previous = 0;
    let x = 0;
    for (let frame = 1; frame <= 30; frame += 1) {
      // The stage reports a new position only every other frame.
      if (frame % 2 === 0) x += 4;
      const [motion] = tracker.update([at(x)], frame * 16, 1 / 60);
      const vx = motion?.vx ?? 0;
      expect(vx).toBeGreaterThanOrEqual(previous - 1);
      previous = vx;
    }
    expect(previous).toBeGreaterThan(0);
  });

  test("slows to rest once the body stops and lets the drag relax", () => {
    const tracker = new FigureMotionTracker();
    tracker.update([at(0)], 0, 1 / 60);
    tracker.update([at(20)], 50, 1 / 60);
    let last = tracker.update([at(20)], 60, 1 / 60)[0];
    for (let t = 80; t < 4000; t += 16) {
      last = tracker.update([at(20)], t, 1 / 60)[0];
    }
    expect(Math.abs(last?.vx ?? 1)).toBeLessThan(1);
    expect(Math.abs(last?.dragX ?? 1)).toBeLessThan(1);
  });
});
