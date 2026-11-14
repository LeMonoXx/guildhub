import { describe, expect, test } from "vitest";
import { daysBetween, formatNumber, formatRelativeTime } from "./format";

describe("format", () => {
  const now = Date.parse("2026-11-14T12:00:00.000Z");

  test("speaks relative time in the active locale", () => {
    expect(formatRelativeTime("2026-11-14T10:00:00.000Z", "en", now)).toBe(
      "2 hours ago",
    );
    expect(formatRelativeTime("2026-11-11T12:00:00.000Z", "de", now)).toBe(
      "vor 3 Tagen",
    );
  });

  test("groups numbers per locale", () => {
    expect(formatNumber(12_345, "de")).toBe("12.345");
    expect(formatNumber(1.234, "en", 1)).toBe("1.2");
  });

  test("counts whole days since a date", () => {
    expect(daysBetween("2026-11-01T12:00:00.000Z", now)).toBe(13);
  });
});
