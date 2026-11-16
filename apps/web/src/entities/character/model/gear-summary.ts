import type { EquippedItem, ItemQuality } from "@guildhub/contracts";
import { durabilityShare, qualityBreakdown } from "./item";

export interface GearSummary {
  readonly averageItemLevel: number;
  readonly equipped: number;
  readonly vendorCopper: number;
  /** Average durability of the pieces that wear, 0 to 1. */
  readonly durability?: number;
  readonly breakdown: readonly { quality: ItemQuality; count: number }[];
}

const average = (values: readonly number[]): number | undefined =>
  values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;

export function gearSummary(items: readonly EquippedItem[]): GearSummary {
  const durability = average(
    items
      .filter((item) => item.durability)
      .map((item) => durabilityShare(item) ?? 1),
  );
  return {
    averageItemLevel:
      average(
        items.flatMap((item) =>
          item.itemLevel === undefined ? [] : [item.itemLevel],
        ),
      ) ?? 0,
    equipped: items.length,
    vendorCopper: items.reduce(
      (sum, item) => sum + (item.sellPriceCopper ?? 0),
      0,
    ),
    ...(durability === undefined ? {} : { durability }),
    breakdown: qualityBreakdown(items),
  };
}

/** The weapon leads; without one, the highest item level. */
export const firstArmorySelection = (
  items: readonly EquippedItem[],
): EquippedItem | undefined =>
  items.find((item) => item.slot === "MAIN_HAND") ??
  [...items].sort(
    (left, right) => (right.itemLevel ?? 0) - (left.itemLevel ?? 0),
  )[0];
