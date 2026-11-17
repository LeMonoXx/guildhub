import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { joinClimbs } from "./history-climbs";

const who = { slug: "ann", name: "Ann", surname: "Example", classId: "1" };
const day = "2026-11-14";
const hour = (h: number) => ({
  day,
  at: `${day}T${String(h).padStart(2, "0")}:00:00.000Z`,
});

describe("joinClimbs", () => {
  test("shows an evening of hourly steps as one climb per member and kind", () => {
    const events: HistoryEvent[] = [
      { ...who, ...hour(21), kind: "level", from: 25, to: 26 },
      { ...who, ...hour(21), kind: "quests", from: 14, to: 17 },
      { ...who, ...hour(20), kind: "quests", from: 10, to: 14 },
      {
        ...who,
        ...hour(20),
        kind: "profession",
        profession: "Mining",
        from: 40,
        to: 52,
      },
      { ...who, ...hour(19), kind: "level", from: 24, to: 25 },
      {
        ...who,
        ...hour(19),
        kind: "profession",
        profession: "Mining",
        from: 31,
        to: 40,
      },
    ];
    expect(joinClimbs(events)).toEqual([
      expect.objectContaining({ kind: "level", from: 24, to: 26 }),
      expect.objectContaining({ kind: "quests", from: 10, to: 17 }),
      expect.objectContaining({ kind: "profession", from: 31, to: 52 }),
    ]);
  });

  test("keeps every gear change and every member apart", () => {
    const events: HistoryEvent[] = [
      { ...who, ...hour(21), kind: "level", from: 25, to: 26 },
      { ...who, ...hour(21), slug: "bob", kind: "level", from: 9, to: 10 },
      { ...who, ...hour(20), kind: "rank", from: 3, to: 2 },
      { ...who, ...hour(19), kind: "rank", from: 2, to: 3 },
    ];
    expect(joinClimbs(events)).toHaveLength(4);
  });
});
