import { rec } from "../../../platform/blizzard/document.js";
import {
  MAIN_HAND_SLOT,
  OFF_HAND_SLOT,
  type CarriedGear,
  type CharacterFacts,
  type CharacterSex,
  type EquipmentOverride,
  type LookCustomization,
} from "../domain/look.js";

const RENDER_ASSET_KEYS = ["main-raw", "main", "inset", "avatar"] as const;
const CARRIED_BY_INVENTORY_TYPE: Readonly<Record<string, CarriedGear>> = {
  SHIELD: "shield",
  TWOHWEAPON: "two-hand",
};
const HAND_SLOTS: Readonly<Record<string, number>> = {
  MAIN_HAND: MAIN_HAND_SLOT,
  OFF_HAND: OFF_HAND_SLOT,
};

export function mapCharacterFacts(input: {
  appearance: unknown;
  equipment: unknown;
  media: unknown;
  fallbackRaceId: number;
  fallbackClassId: number;
}): CharacterFacts {
  const appearance = rec(input.appearance);
  const customizations = mapCustomizations(appearance.customizations);
  const equipped = mapEquipment(input.equipment);
  const appearanceItems = mapAppearanceItems(appearance.items);
  const itemIds =
    equipped.itemIds.length > 0 ? equipped.itemIds : appearanceItems;
  return {
    raceId: idOf(appearance.playable_race) ?? input.fallbackRaceId,
    sex: mapSex(appearance.gender),
    classId: idOf(appearance.playable_class) ?? input.fallbackClassId,
    customizations,
    itemIds,
    equipmentOverrides: equipped.overrides,
    ...(equipped.carries.length === 0 ? {} : { carries: equipped.carries }),
    renderAssetUrl: pickRenderAsset(input.media),
    ...(pickAsset(input.media, "avatar") === undefined
      ? {}
      : { avatarAssetUrl: pickAsset(input.media, "avatar") }),
  };
}

function pickAsset(value: unknown, key: string): string | undefined {
  return mediaAssets(value).find((asset) => asset.key === key)?.url;
}

function mediaAssets(value: unknown): { key: string; url: string }[] {
  const record = rec(value);
  const assets = Array.isArray(record.assets) ? record.assets : [];
  return assets.flatMap((asset) => {
    const entry = rec(asset);
    const key = namedType(entry.key).toLowerCase();
    const url = typeof entry.value === "string" ? entry.value : undefined;
    if (url === undefined || !/^https?:\/\//.test(url)) return [];
    return [{ key, url }];
  });
}

function mapCustomizations(value: unknown): readonly LookCustomization[] {
  if (!Array.isArray(value)) return [];
  const mapped: LookCustomization[] = [];
  for (const entry of value) {
    const record = rec(entry);
    const optionId = idOf(record.option);
    const choiceId = idOf(record.choice);
    if (optionId === undefined || choiceId === undefined) continue;
    mapped.push({ optionId, choiceId });
  }
  return mapped;
}

function mapEquipment(value: unknown): {
  itemIds: readonly number[];
  overrides: readonly EquipmentOverride[];
  carries: readonly CarriedGear[];
} {
  const record = rec(value);
  const items = Array.isArray(record.equipped_items)
    ? record.equipped_items
    : [];
  const itemIds: number[] = [];
  const overrides: EquipmentOverride[] = [];
  const carries = new Set<CarriedGear>();
  const seen = new Set<number>();
  for (const item of items) {
    const carried =
      CARRIED_BY_INVENTORY_TYPE[namedType(rec(item).inventory_type)];
    if (carried !== undefined) carries.add(carried);
    const mapped = mapEquippedItem(item);
    if (mapped === undefined || seen.has(mapped.itemId)) continue;
    seen.add(mapped.itemId);
    itemIds.push(mapped.itemId);
    if (mapped.override !== undefined) overrides.push(mapped.override);
  }
  return { itemIds, overrides, carries: [...carries] };
}

function mapEquippedItem(value: unknown):
  | {
      itemId: number;
      override?: EquipmentOverride;
    }
  | undefined {
  const record = rec(value);
  const transmog = rec(record.transmog);
  const itemId = idOf(transmog.item) ?? idOf(record.item);
  if (itemId === undefined) return undefined;
  const slot = slotType(record.slot);
  const equipSlot = slot === undefined ? undefined : HAND_SLOTS[slot];
  return {
    itemId,
    override: equipSlot === undefined ? undefined : { itemId, equipSlot },
  };
}

function mapAppearanceItems(value: unknown): readonly number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const id = idOf(rec(item));
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function mapSex(value: unknown): CharacterSex {
  return namedType(value).toUpperCase() === "FEMALE" ? 1 : 0;
}

function pickRenderAsset(value: unknown): string | undefined {
  const parsed = mediaAssets(value);
  for (const preferred of RENDER_ASSET_KEYS) {
    const match = parsed.find((asset) => asset.key === preferred);
    if (match !== undefined) return match.url;
  }
  return parsed[0]?.url;
}

function namedType(value: unknown): string {
  if (typeof value === "string") return value;
  const type = rec(value).type;
  return typeof type === "string" ? type : "";
}

function slotType(value: unknown): string | undefined {
  const record = rec(value);
  return typeof record.type === "string" ? record.type : undefined;
}

function idOf(value: unknown): number | undefined {
  const record = rec(value);
  return typeof record.id === "number" && record.id > 0 ? record.id : undefined;
}
