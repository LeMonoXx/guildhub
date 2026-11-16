import type { EquippedItem, ItemQuality, ItemStat } from "@guildhub/contracts";
import {
  int,
  list,
  name,
  num,
  optional,
  rec,
  str,
} from "../../../platform/blizzard/document.js";

const QUALITIES: readonly ItemQuality[] = [
  "POOR",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "ARTIFACT",
  "HEIRLOOM",
];

export function quality(value: unknown): ItemQuality | undefined {
  const type = str(rec(value).type);
  return QUALITIES.find((entry) => entry === type);
}

export function mapEquippedItem(
  value: unknown,
  iconUrl: (iconId: number) => string,
  itemIcons: ReadonlyMap<number, number>,
): EquippedItem | undefined {
  const record = rec(value);
  const itemId = int(rec(record.item).id);
  const slot = rec(record.slot);
  const slotType = str(slot.type);
  const label = str(record.name);
  const itemQuality = quality(record.quality);
  if (itemId === undefined || !slotType || !label || !itemQuality) {
    return undefined;
  }
  const iconId = itemIcons.get(int(rec(record.media).id) ?? itemId);
  const sell = int(rec(record.sell_price).value);
  return {
    slot: slotType,
    slotName: str(slot.name) ?? slotType,
    itemId,
    name: label,
    quality: itemQuality,
    qualityName: name(record.quality) ?? itemQuality,
    ...optional("iconUrl", iconId === undefined ? undefined : iconUrl(iconId)),
    ...optional("itemLevel", int(rec(record.level).value)),
    ...optional(
      "requiredLevel",
      int(rec(rec(record.requirements).level).value),
    ),
    ...optional("binding", name(record.binding)),
    ...optional("itemClass", name(record.item_class)),
    ...optional(
      "itemSubclass",
      record.is_subclass_hidden === true
        ? undefined
        : name(record.item_subclass),
    ),
    ...optional("inventoryType", name(record.inventory_type)),
    ...optional("armor", displayString(record.armor)),
    ...optional("shieldBlock", displayString(record.shield_block)),
    ...optional("weapon", mapWeapon(rec(record.weapon))),
    stats: list(record.stats).flatMap(mapStat),
    enchantments: list(record.enchantments).flatMap((entry) => {
      const text = str(rec(entry).display_string);
      return text ? [text] : [];
    }),
    ...optional("durability", mapDurability(rec(record.durability))),
    ...optional("sellPriceCopper", sell),
    ...optional("description", str(record.description)),
    quantity: Math.max(1, int(record.quantity) ?? 1),
  };
}

function mapWeapon(
  weapon: Record<string, unknown>,
): EquippedItem["weapon"] | undefined {
  const damage = rec(weapon.damage);
  const speed = rec(weapon.attack_speed);
  const dps = rec(weapon.dps);
  const damageText = str(damage.display_string);
  if (damageText === undefined) return undefined;
  return {
    damage: damageText,
    ...optional("damageClass", name(damage.damage_class)),
    minDamage: num(damage.min_value) ?? 0,
    maxDamage: num(damage.max_value) ?? 0,
    ...optional("speed", str(speed.display_string)),
    speedSeconds: (num(speed.value) ?? 0) / 1000,
    ...optional("dps", str(dps.display_string)),
    dpsValue: num(dps.value) ?? 0,
  };
}

function mapStat(entry: unknown): ItemStat[] {
  const stat = rec(entry);
  const display = rec(stat.display);
  const type = str(rec(stat.type).type);
  const label = str(display.display_string);
  if (!type || !label) return [];
  return [
    {
      type,
      label,
      value: num(stat.value) ?? 0,
      equipBonus: stat.is_equip_bonus === true,
      ...optional("color", hexColor(display.color)),
    },
  ];
}

function mapDurability(
  durability: Record<string, unknown>,
): EquippedItem["durability"] | undefined {
  const current = int(durability.value);
  if (current === undefined) return undefined;
  const max = /\/\s*(\d+)/.exec(str(durability.display_string) ?? "");
  return {
    current: Math.max(0, current),
    max: Math.max(0, Number(max?.[1] ?? 0)),
  };
}

function displayString(value: unknown): string | undefined {
  return str(rec(rec(value).display).display_string);
}

function hexColor(value: unknown): string | undefined {
  const color = rec(value);
  const channels = [color.r, color.g, color.b].map((c) => int(c));
  if (channels.some((c) => c === undefined)) return undefined;
  return `#${channels
    .map((c) =>
      Math.min(255, Math.max(0, c ?? 0))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
