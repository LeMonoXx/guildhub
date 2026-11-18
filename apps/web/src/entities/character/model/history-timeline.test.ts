import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { historyTimeline, type TimelineAchievement } from "./history-timeline";

const member = { slug: "aria", name: "Aria", surname: "Storm", classId: "8" };

const level = (at: string, to: number): HistoryEvent => ({
  ...member,
  day: at.slice(0, 10),
  at,
  kind: "level",
  from: to - 1,
  to,
});

const counted = (at: string): HistoryEvent => ({
  ...member,
  day: at.slice(0, 10),
  at,
  kind: "achievements",
  count: 2,
  points: 20,
});

const listed = (at: string, title: string): TimelineAchievement => ({
  ...member,
  title,
  at,
});

const shape = (
  events: readonly HistoryEvent[],
  achievements: TimelineAchievement[] = [],
) =>
  historyTimeline(events, achievements, "UTC").map((day) => [
    day.day,
    day.entries.map((entry) =>
      entry.type === "achievement"
        ? `achievement ${entry.achievement.title}`
        : `${entry.event.kind} ${entry.at.slice(11, 16)}`,
    ),
  ]);

describe("history timeline", () => {
  it("keeps every change on its own, newest first, under its day", () => {
    expect(
      shape([
        level("2026-11-17T18:00:00.000Z", 21),
        level("2026-11-18T09:00:00.000Z", 23),
        level("2026-11-18T08:00:00.000Z", 22),
      ]),
    ).toEqual([
      ["2026-11-18", ["level 09:00", "level 08:00"]],
      ["2026-11-17", ["level 18:00"]],
    ]);
  });

  it("puts listed achievements between changes at the time they were earned", () => {
    expect(
      shape(
        [
          level("2026-11-18T09:00:00.000Z", 23),
          level("2026-11-18T07:00:00.000Z", 22),
        ],
        [listed("2026-11-18T08:15:00.000Z", "Explorer")],
      ),
    ).toEqual([
      ["2026-11-18", ["level 09:00", "achievement Explorer", "level 07:00"]],
    ]);
  });

  it("shows an achievement both lists know once", () => {
    const event: HistoryEvent = {
      ...member,
      day: "2026-11-18",
      at: "2026-11-18T08:15:00.000Z",
      kind: "achievement",
      achievementId: 7,
      achievement: "Explorer",
    };
    expect(shape([event], [listed(event.at, "Explorer")])).toEqual([
      ["2026-11-18", ["achievement Explorer"]],
    ]);
  });

  it("keeps a count of achievements only from before the first listed one", () => {
    expect(
      shape(
        [
          counted("2026-11-18T10:00:00.000Z"),
          counted("2026-11-16T10:00:00.000Z"),
        ],
        [listed("2026-11-18T09:30:00.000Z", "Explorer")],
      ),
    ).toEqual([
      ["2026-11-18", ["achievement Explorer"]],
      ["2026-11-16", ["achievements 10:00"]],
    ]);
  });
});
