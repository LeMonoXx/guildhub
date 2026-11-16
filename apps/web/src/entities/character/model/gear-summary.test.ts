import type { EquippedItem } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { fixtureCharacterProfile } from "../api/profile-fixtures";
import { firstArmorySelection, gearSummary } from "./gear-summary";

const base = fixtureCharacterProfile("shade")?.equipment[0];

const item = (overrides: Partial<EquippedItem>): EquippedItem => {
  if (!base) throw new Error("fixture has no equipment");
  return { ...base, durability: undefined, itemLevel: undefined, ...overrides };
};

describe("gearSummary", () => {
  test("averages item level and durability over the pieces that have them", () => {
    const summary = gearSummary([
      item({ slot: "HEAD", itemLevel: 10, sellPriceCopper: 5 }),
      item({
        slot: "CHEST",
        itemLevel: 20,
        sellPriceCopper: 7,
        durability: { current: 50, max: 100 },
      }),
      item({ slot: "NECK", sellPriceCopper: 0 }),
    ]);
    expect(summary.averageItemLevel).toBe(15);
    expect(summary.equipped).toBe(3);
    expect(summary.vendorCopper).toBe(12);
    expect(summary.durability).toBe(0.5);
  });

  test("leaves durability out when nothing wears", () => {
    expect(gearSummary([item({ slot: "NECK" })]).durability).toBeUndefined();
  });
});

describe("firstArmorySelection", () => {
  test("prefers the main hand, then the highest item level", () => {
    const head = item({ slot: "HEAD", itemLevel: 30 });
    const ring = item({ slot: "FINGER_1", itemLevel: 40 });
    const weapon = item({ slot: "MAIN_HAND", itemLevel: 5 });
    expect(firstArmorySelection([head, weapon, ring])).toBe(weapon);
    expect(firstArmorySelection([head, ring])).toBe(ring);
  });
});
