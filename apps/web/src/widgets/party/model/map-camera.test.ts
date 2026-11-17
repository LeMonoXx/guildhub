import { describe, expect, test } from "vitest";
import {
  clampCamera,
  focusedZone,
  MAX_SCALE,
  panBy,
  zoomAt,
} from "./map-camera";

describe("map camera", () => {
  test("never zooms out past the whole map or lets an edge show", () => {
    expect(clampCamera({ scale: 0.5, x: 20, y: -10 })).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
    expect(clampCamera({ scale: 2, x: -150, y: 10 })).toEqual({
      scale: 2,
      x: -100,
      y: 0,
    });
    expect(clampCamera({ scale: 99, x: 0, y: 0 }).scale).toBe(MAX_SCALE);
  });

  test("keeps the point under the cursor in place while zooming", () => {
    const camera = { scale: 2, x: -40, y: -30 };
    const next = zoomAt(camera, 1.5, 0.25, 0.75);
    const before = (25 - camera.x) / camera.scale;
    const after = (25 - next.x) / next.scale;
    expect(next.scale).toBe(3);
    expect(after).toBeCloseTo(before);
  });

  test("focuses the zone under the middle of the stage once zoomed in", () => {
    const zone = (uiMapId: number, left: number, right: number) => ({
      uiMapId,
      name: String(uiMapId),
      areaIds: [],
      rect: { left, right, top: 0, bottom: 1 },
      image: { path: `${String(uiMapId)}.png`, width: 1, height: 1 },
    });
    const zones = [zone(1, 0, 0.5), zone(2, 0.4, 1)];
    const onLeft = { scale: 4, x: -50, y: -150 };
    expect(focusedZone(zones, onLeft)?.uiMapId).toBe(1);
    expect(focusedZone(zones, { ...onLeft, x: -230 })?.uiMapId).toBe(2);
    expect(focusedZone(zones, { scale: 1.5, x: 0, y: 0 })).toBeUndefined();
  });

  test("pans by stage percent and stops at the edge", () => {
    expect(panBy({ scale: 2, x: -50, y: -50 }, 10, -80)).toEqual({
      scale: 2,
      x: -40,
      y: -100,
    });
  });
});
