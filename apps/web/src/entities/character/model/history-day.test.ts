import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { groupHistoryByDay, splitHistoryDay } from "./history-day";

const who = { slug: "ann", name: "Ann", surname: "Example", classId: "1" };
const day = "2026-11-14";

describe("splitHistoryDay", () => {
  test("puts roster changes in banners, level-ups in cards and the rest in ordered rows", () => {
    const events: HistoryEvent[] = [
      { ...who, day, kind: "mount", mount: "Horse" },
      { ...who, day, kind: "joined" },
      { ...who, day, kind: "level", from: 9, to: 10 },
      { ...who, day, kind: "rank", from: 3, to: 2 },
      { ...who, day, kind: "mount", mount: "Wolf" },
    ];
    const split = splitHistoryDay(events);
    expect(split.banners.map((event) => event.kind)).toEqual(["joined"]);
    expect(split.levels).toHaveLength(1);
    expect(split.rows.map((group) => group.map((event) => event.kind))).toEqual(
      [["rank"], ["mount", "mount"]],
    );
  });

  test("keeps every gear change on its own row", () => {
    const item = {
      ...who,
      day,
      kind: "item",
      slot: "HEAD",
      itemId: 1,
      item: "Hood",
      quality: "RARE",
    } as const;
    expect(splitHistoryDay([item, { ...item, itemId: 2 }]).rows).toHaveLength(
      2,
    );
  });
});

describe("groupHistoryByDay", () => {
  test("keeps the order of days as given", () => {
    const days = groupHistoryByDay([
      { ...who, day: "2026-11-14", kind: "joined" },
      { ...who, day: "2026-11-13", kind: "left" },
      { ...who, day: "2026-11-14", kind: "left" },
    ]);
    expect([...days.keys()]).toEqual(["2026-11-14", "2026-11-13"]);
    expect(days.get("2026-11-14")).toHaveLength(2);
  });
});
