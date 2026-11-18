import { describe, expect, it } from "vitest";
import { laneScale } from "./lane-scale";

describe("lane scale", () => {
  const from = "2026-11-18T08:30:00.000Z";
  const to = "2026-11-18T12:00:00.000Z";
  const now = Date.parse("2026-11-18T12:30:00.000Z");

  it("starts an hour before the first mark and ends an hour after now", () => {
    const scale = laneScale(from, to, 10, now);
    expect(scale.x("2026-11-18T07:00:00.000Z")).toBe(0);
    expect(scale.x(from)).toBe(15);
    expect(scale.width).toBe(65);
  });

  it("leaves a day's label room before naming the next hour", () => {
    const ticks = laneScale(
      "2026-11-17T20:00:00",
      "2026-11-18T06:00:00",
      24,
      Date.parse("2026-11-18T06:00:00"),
    ).ticks.map((tick) => [new Date(tick.at).getHours(), tick.day]);
    expect(ticks).toContainEqual([0, true]);
    expect(ticks).not.toContainEqual([2, false]);
    expect(ticks).toContainEqual([4, false]);
  });

  it("spaces hour ticks so their labels never crowd", () => {
    const steps = (pxPerHour: number) => {
      const [first, second] = laneScale(
        from,
        "2026-11-20T00:00:00.000Z",
        pxPerHour,
        now,
      ).ticks;
      return first && second ? second.x - first.x : undefined;
    };
    expect(steps(64)).toBe(64);
    expect(steps(24)).toBe(48);
    expect(steps(12)).toBe(72);
  });
});
