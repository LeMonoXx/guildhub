import { describe, expect, test } from "vitest";
import { placeOnStage } from "./stage-view";

describe("placeOnStage", () => {
  test("keeps a fully framed stage where it is", () => {
    const box = { left: 0.2, top: 0.3, width: 0.1, height: 0.4 };
    expect(placeOnStage(box, 1)).toEqual(box);
  });

  test("maps the framed view onto the top of a stage with padding below", () => {
    const placed = placeOnStage(
      { left: 0.2, top: 0.5, width: 0.1, height: 0.4 },
      0.7,
    );
    expect(placed.left).toBe(0.2);
    expect(placed.width).toBe(0.1);
    expect(placed.top).toBeCloseTo(0.35);
    expect(placed.height).toBeCloseTo(0.28);
  });
});
