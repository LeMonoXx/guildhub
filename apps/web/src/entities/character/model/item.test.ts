import { describe, expect, test } from "vitest";
import { fixtureCharacterProfile } from "../api/profile-fixtures";
import {
  durabilityShare,
  itemQualityColorVar,
  itemsBySlot,
  paperDollSlots,
  qualityBreakdown,
  splitCoins,
} from "./item";
import { powerColorVar, reputationColorVar } from "./vitals";

describe("item model", () => {
  test("splits copper into gold, silver and copper", () => {
    expect(splitCoins(12_345)).toEqual({ gold: 1, silver: 23, copper: 45 });
    expect(splitCoins(99)).toEqual({ gold: 0, silver: 0, copper: 99 });
  });

  test("colors items by quality token", () => {
    expect(itemQualityColorVar("EPIC")).toBe("var(--quality-epic)");
  });

  test("lays out every equipment slot exactly once", () => {
    const all = [
      ...paperDollSlots.left,
      ...paperDollSlots.right,
      ...paperDollSlots.weapons,
    ];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(19);
  });

  test("indexes, ranks and wears items from the profile", () => {
    const profile = fixtureCharacterProfile("shade");
    expect(profile).toBeDefined();
    if (!profile) return;
    const bySlot = itemsBySlot(profile.equipment);
    expect(bySlot.get("HEAD")?.name).toBe("Fixture Hood");
    expect(qualityBreakdown(profile.equipment)[0]).toEqual({
      quality: "EPIC",
      count: 1,
    });
    const head = bySlot.get("HEAD");
    expect(head && durabilityShare(head)).toBeCloseTo(0.8);
  });

  test("maps vitals to unit frame colours", () => {
    expect(powerColorVar("Energy")).toBe("var(--power-energy)");
    expect(powerColorVar(undefined)).toBe("var(--power-mana)");
    expect(reputationColorVar(9)).toBe("var(--standing-7)");
  });
});
