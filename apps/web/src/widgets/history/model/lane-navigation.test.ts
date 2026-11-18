import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { historyLanes, type HistoryLanes } from "./history-lanes";
import { stepFrom, stepOf } from "./lane-navigation";

const quests = (slug: string, at: string): HistoryEvent => ({
  slug,
  name: slug,
  surname: "",
  classId: "1",
  day: at.slice(0, 10),
  at,
  kind: "quests",
  from: 1,
  to: 2,
});

const lanes = historyLanes([
  quests("aria", "2026-11-18T08:00:00.000Z"),
  quests("aria", "2026-11-18T12:00:00.000Z"),
  quests("aria", "2026-11-18T20:00:00.000Z"),
  quests("bram", "2026-11-18T11:00:00.000Z"),
  quests("bram", "2026-11-18T21:00:00.000Z"),
]) as HistoryLanes;

const ariaAt = (time: string) => `aria|2026-11-18T${time}:00.000Z`;
const bramAt = (time: string) => `bram|2026-11-18T${time}:00.000Z`;

describe("lane navigation", () => {
  it("reads arrows, Home and End as steps and ignores other keys", () => {
    expect(["ArrowLeft", "ArrowDown", "End", "a"].map(stepOf)).toEqual([
      "previous",
      "down",
      "last",
      undefined,
    ]);
  });

  it("walks along a lane and stops at its ends", () => {
    expect(stepFrom(lanes, ariaAt("12:00"), "next")?.key).toBe(ariaAt("20:00"));
    expect(stepFrom(lanes, ariaAt("12:00"), "previous")?.key).toBe(
      ariaAt("08:00"),
    );
    expect(stepFrom(lanes, ariaAt("20:00"), "next")).toBeUndefined();
    expect(stepFrom(lanes, ariaAt("20:00"), "first")?.key).toBe(
      ariaAt("08:00"),
    );
  });

  it("changes lanes to the mark nearest in time", () => {
    expect(lanes.lanes.map((lane) => lane.member.slug)).toEqual([
      "bram",
      "aria",
    ]);
    expect(stepFrom(lanes, bramAt("11:00"), "down")?.key).toBe(ariaAt("12:00"));
    expect(stepFrom(lanes, ariaAt("20:00"), "up")?.key).toBe(bramAt("21:00"));
    expect(stepFrom(lanes, bramAt("11:00"), "up")).toBeUndefined();
  });
});
