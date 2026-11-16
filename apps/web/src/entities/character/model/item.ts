import type { EquippedItem, ItemQuality } from "@guildhub/contracts";

export const itemQualityColorVar = (quality: ItemQuality): string =>
  `var(--quality-${quality.toLowerCase()})`;

/** Equipment slots as the in-game character sheet lays them out. */
export const paperDollSlots = {
  left: [
    "HEAD",
    "NECK",
    "SHOULDER",
    "BACK",
    "CHEST",
    "SHIRT",
    "TABARD",
    "WRIST",
  ],
  right: [
    "HANDS",
    "WAIST",
    "LEGS",
    "FEET",
    "FINGER_1",
    "FINGER_2",
    "TRINKET_1",
    "TRINKET_2",
  ],
  weapons: ["MAIN_HAND", "OFF_HAND", "RANGED"],
} as const;

export type PaperDollSlot =
  | (typeof paperDollSlots.left)[number]
  | (typeof paperDollSlots.right)[number]
  | (typeof paperDollSlots.weapons)[number];

export const itemsBySlot = (
  items: readonly EquippedItem[],
): ReadonlyMap<string, EquippedItem> =>
  new Map(items.map((item) => [item.slot, item]));

export interface Coins {
  readonly gold: number;
  readonly silver: number;
  readonly copper: number;
}

export const splitCoins = (copper: number): Coins => ({
  gold: Math.floor(copper / 10_000),
  silver: Math.floor((copper % 10_000) / 100),
  copper: copper % 100,
});

const qualityRank: Readonly<Record<ItemQuality, number>> = {
  POOR: 0,
  COMMON: 1,
  UNCOMMON: 2,
  RARE: 3,
  EPIC: 4,
  LEGENDARY: 5,
  ARTIFACT: 6,
  HEIRLOOM: 7,
};

export const qualityBreakdown = (
  items: readonly EquippedItem[],
): readonly { quality: ItemQuality; count: number }[] => {
  const counts = new Map<ItemQuality, number>();
  for (const item of items) {
    counts.set(item.quality, (counts.get(item.quality) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([quality, count]) => ({ quality, count }))
    .sort(
      (left, right) => qualityRank[right.quality] - qualityRank[left.quality],
    );
};

export const durabilityShare = (item: EquippedItem): number | undefined =>
  item.durability && item.durability.max > 0
    ? item.durability.current / item.durability.max
    : undefined;

const durabilityBands = [
  { above: 0.5, color: "var(--color-signal)" },
  { above: 0.2, color: "var(--color-gold)" },
] as const;

export const durabilityColorVar = (share: number): string =>
  durabilityBands.find((band) => share > band.above)?.color ??
  "var(--color-danger)";
