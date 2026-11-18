import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import {
  featuredMark,
  historyLanes,
  type HistoryLanes,
  type TimelineAchievement,
} from "./history-lanes";

const aria = { slug: "aria", name: "Aria", surname: "Storm", classId: "8" };
const bram = { slug: "bram", name: "Bram", surname: "Oak", classId: "1" };

const level = (at: string, to: number, member = aria): HistoryEvent => ({
  ...member,
  day: at.slice(0, 10),
  at,
  kind: "level",
  from: to - 1,
  to,
});

const quests = (at: string, member = aria): HistoryEvent => ({
  ...member,
  day: at.slice(0, 10),
  at,
  kind: "quests",
  from: 10,
  to: 12,
});

const counted = (at: string): HistoryEvent => ({
  ...aria,
  day: at.slice(0, 10),
  at,
  kind: "achievements",
  count: 2,
  points: 20,
});

const listed = (at: string, title: string): TimelineAchievement => ({
  ...aria,
  title,
  at,
});

const shape = (lanes: HistoryLanes | undefined) =>
  lanes?.lanes.map((lane) => [
    lane.member.slug,
    lane.marks.map((mark) =>
      mark.type === "achievement"
        ? `achievement ${mark.achievement.title}`
        : `${mark.lead} ${mark.at.slice(11, 16)} x${String(mark.events.length)}`,
    ),
  ]);

describe("history lanes", () => {
  it("gives every member a lane, the most recently active first", () => {
    expect(
      shape(
        historyLanes([
          level("2026-11-18T09:00:00.000Z", 23),
          quests("2026-11-18T10:00:00.000Z", bram),
        ]),
      ),
    ).toEqual([
      ["bram", ["quests 10:00 x1"]],
      ["aria", ["level 09:00 x1"]],
    ]);
  });

  it("makes everything a member changed in one check one mark, led by a level-up", () => {
    const lanes = historyLanes([
      quests("2026-11-18T09:00:00.000Z"),
      level("2026-11-18T09:00:00.000Z", 23),
    ]);
    expect(shape(lanes)).toEqual([["aria", ["level 09:00 x2"]]]);
    expect(lanes?.lanes[0]?.marks[0]).toMatchObject({ level: { to: 23 } });
  });

  it("puts achievements at the time they were earned and shows each once", () => {
    const recorded: HistoryEvent = {
      ...aria,
      day: "2026-11-18",
      at: "2026-11-18T08:15:00.000Z",
      kind: "achievement",
      achievementId: 7,
      achievement: "Explorer",
    };
    expect(
      shape(
        historyLanes(
          [level("2026-11-18T09:00:00.000Z", 23), recorded],
          [listed(recorded.at, "Explorer")],
        ),
      ),
    ).toEqual([["aria", ["achievement Explorer", "level 09:00 x1"]]]);
  });

  it("keeps a count of achievements only from before the first listed one", () => {
    expect(
      shape(
        historyLanes(
          [
            counted("2026-11-18T10:00:00.000Z"),
            counted("2026-11-16T10:00:00.000Z"),
          ],
          [listed("2026-11-18T09:30:00.000Z", "Explorer")],
        ),
      ),
    ).toEqual([["aria", ["achievements 10:00 x1", "achievement Explorer"]]]);
  });

  it("joins marks an hour apart into one session", () => {
    const lanes = historyLanes([
      quests("2026-11-18T08:00:00.000Z"),
      quests("2026-11-18T09:00:00.000Z"),
      quests("2026-11-18T10:00:00.000Z"),
      quests("2026-11-18T15:00:00.000Z"),
    ]);
    expect(lanes?.lanes[0]?.sessions).toEqual([
      { from: "2026-11-18T08:00:00.000Z", to: "2026-11-18T10:00:00.000Z" },
    ]);
  });

  it("opens on the latest level-up", () => {
    const lanes = historyLanes([
      level("2026-11-18T08:00:00.000Z", 23),
      quests("2026-11-18T10:00:00.000Z", bram),
    ]);
    expect(lanes && featuredMark(lanes)?.key).toBe(
      "aria|2026-11-18T08:00:00.000Z",
    );
  });

  it("has nothing to draw without changes", () => {
    expect(historyLanes([])).toBeUndefined();
  });
});
