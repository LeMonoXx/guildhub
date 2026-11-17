import { describe, expect, it } from "vitest";
import { checkTrend } from "./check-trend";

describe("checkTrend", () => {
  it("keeps every check of a day and skips checks without a value", () => {
    const points = [
      { at: "2026-11-01T08:00:00.000Z", level: 10 },
      { at: "2026-11-01T09:00:00.000Z", level: undefined },
      { at: "2026-11-01T10:00:00.000Z", level: 12 },
    ];
    const labels = (locale: string) =>
      checkTrend(points, (point) => point.level, locale);
    expect(labels("de-DE").map((point) => point.value)).toEqual([10, 12]);
    const [morning, noon] = labels("de-DE");
    expect(morning?.label).toMatch(/^01\.11\., \d\d:00$/);
    expect(morning?.label).not.toBe(noon?.label);
  });
});
