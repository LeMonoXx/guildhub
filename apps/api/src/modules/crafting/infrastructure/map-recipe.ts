import {
  itemQualitySchema,
  type CraftedItem,
  type Recipe,
  type RecipeSource,
  type RecipeStat,
} from "@guildhub/contracts";
import {
  list,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import type { ListedRecipe } from "./battle-net-recipe-listing.js";

export interface RecipeDocuments {
  readonly listed: ListedRecipe;
  readonly name: string;
  readonly body: Record<string, unknown>;
  readonly iconUrl: string | undefined;
  readonly craftedItem: CraftedItem | undefined;
  readonly source: RecipeSource;
}

export function mapRecipe(documents: RecipeDocuments): Recipe {
  const { listed, body, iconUrl, craftedItem } = documents;
  return {
    id: listed.id,
    name: documents.name,
    professionId: listed.professionId,
    profession: listed.profession,
    category: listed.category || listed.profession,
    ...(iconUrl === undefined ? {} : { iconUrl }),
    ...(craftedItem === undefined ? {} : { craftedItem }),
    craftedQuantity: Math.max(
      1,
      positiveInt(rec(body.crafted_quantity).value) ?? 1,
    ),
    reagents: reagentsOf(body),
    source: documents.source,
  };
}

function reagentsOf(body: Record<string, unknown>): Recipe["reagents"] {
  return list(body.reagents).flatMap((reagent) => {
    const record = rec(reagent);
    const itemId = positiveInt(rec(record.reagent).id);
    const name = str(rec(record.reagent).name);
    const quantity = positiveInt(record.quantity);
    return itemId === undefined || name === undefined || quantity === undefined
      ? []
      : [{ itemId, name, quantity }];
  });
}

export function mapCraftedItem(
  id: number,
  body: Record<string, unknown> | undefined,
  iconUrl: string | undefined,
): CraftedItem | undefined {
  const name = str(body?.name);
  const quality = itemQualitySchema.safeParse(rec(body?.quality).type);
  if (!body || !name || !quality.success) return undefined;
  const preview = rec(body.preview_item);
  const slot = rec(body.inventory_type);
  const slotName = str(slot.name);
  const itemLevel = positiveInt(body.level);
  return {
    id,
    name,
    quality: quality.data,
    ...(iconUrl === undefined ? {} : { iconUrl }),
    ...(itemLevel === undefined ? {} : { itemLevel }),
    ...(slot.type === "NON_EQUIP" || slotName === undefined
      ? {}
      : { slot: slotName }),
    stats: statsOf(preview),
    effects: list(preview.spells).flatMap((spell) => {
      const text = str(rec(spell).description);
      return text === undefined ? [] : [text];
    }),
  };
}

function statsOf(preview: Record<string, unknown>): RecipeStat[] {
  const stats = list(preview.stats).flatMap((entry): RecipeStat[] => {
    const record = rec(entry);
    // Some stat keys arrive with a trailing comma, e.g. "BONUS_STAT_MINING_SKILL,".
    const type = str(rec(record.type).type)?.replace(/,+$/, "");
    const name = str(rec(record.type).name);
    const value = typeof record.value === "number" ? record.value : undefined;
    return type === undefined ||
      name === undefined ||
      value === undefined ||
      record.is_negated === true
      ? []
      : [{ type, name, value }];
  });
  const armor = rec(preview.armor).value;
  return typeof armor === "number" && armor > 0
    ? [{ type: "ARMOR", name: "Armor", value: armor }, ...stats]
    : stats;
}
