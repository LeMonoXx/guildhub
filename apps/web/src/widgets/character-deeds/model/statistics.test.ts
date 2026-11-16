import type { StatisticGroup } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { spotlightGroups, toldGroups } from "./statistics";

const group = (id: number, quantities: readonly number[]): StatisticGroup => ({
  id,
  name: `Group ${String(id)}`,
  entries: quantities.map((quantity, index) => ({
    name: `Entry ${String(index)}`,
    quantity,
  })),
});

describe("statistics", () => {
  test("drops zeros and empty groups and sorts entries by size", () => {
    const told = toldGroups([group(1, [0, 3, -9]), group(2, [0])]);
    expect(told).toHaveLength(1);
    expect(told[0]?.entries.map((entry) => entry.quantity)).toEqual([-9, 3]);
  });

  test("spotlights the four groups with the largest lead", () => {
    const told = toldGroups([
      group(1, [5]),
      group(2, [50]),
      group(3, [1]),
      group(4, [20]),
      group(5, [7]),
    ]);
    expect(spotlightGroups(told).map((entry) => entry.id)).toEqual([
      2, 4, 5, 1,
    ]);
  });
});
