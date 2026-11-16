import { describe, expect, it } from "vitest";
import { dailyTrend } from "./daily-trend";

describe("dailyTrend", () => {
  it("labels each day with its short date and skips days without a value", () => {
    const points = [
      { day: "2026-11-01", level: 10 },
      { day: "2026-11-02", level: undefined },
      { day: "2026-11-03", level: 12 },
    ];
    expect(dailyTrend(points, (point) => point.level, "de-DE")).toEqual([
      { label: "01.11.", value: 10 },
      { label: "03.11.", value: 12 },
    ]);
  });
});
