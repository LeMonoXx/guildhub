import { wowForever } from "@blizzard-api/wow-forever";
import {
  itemQualitySchema,
  type ContentLocale,
  type ItemQuality,
  type RecipeSource,
} from "@guildhub/contracts";
import {
  list,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import { battleNetLocaleOf } from "../../../platform/blizzard/request.js";
import type { GetGameData } from "./battle-net-game-data.js";

const SEARCH_PAGE_SIZE = 1000;
const RECIPE_ITEM_CLASS = 9;

interface RecipeItem {
  readonly id: number;
  readonly name: string;
  readonly quality: ItemQuality;
}

/** Recipe items ("Recipe: …", "Pattern: …") keyed by the lowercase name they teach. */
export async function recipeItems(
  get: GetGameData,
  locale: ContentLocale,
): Promise<ReadonlyMap<string, RecipeItem>> {
  const byTaughtName = new Map<string, RecipeItem>();
  const search = wowForever.itemSearch({ name: "", locale: "en_US" });
  // Answers are capped at one page, so walk the ids rather than pages.
  for (let from = 1; ;) {
    const body = await get(
      {
        ...search,
        parameters: {
          "item_class.id": RECIPE_ITEM_CLASS,
          id: `[${String(from)},]`,
          _pageSize: SEARCH_PAGE_SIZE,
          orderby: "id",
        },
      },
      locale,
    );
    const results = list(body?.results).map((result) => rec(rec(result).data));
    for (const data of results) {
      const taught = taughtItemOf(data, locale);
      if (taught) byTaughtName.set(taught.name, taught.item);
    }
    const last = Math.max(
      0,
      ...results.map((data) => positiveInt(data.id) ?? 0),
    );
    if (results.length < SEARCH_PAGE_SIZE || last < from) break;
    from = last + 1;
  }
  return byTaughtName;
}

function taughtItemOf(
  data: Record<string, unknown>,
  locale: ContentLocale,
): { readonly name: string; readonly item: RecipeItem } | undefined {
  const id = positiveInt(data.id);
  const name = str(rec(data.name)[battleNetLocaleOf(locale)]);
  const quality = itemQualitySchema.safeParse(rec(data.quality).type);
  const taught = name?.split(": ").slice(1).join(": ");
  if (id === undefined || name === undefined || !taught || !quality.success)
    return undefined;
  return {
    name: taught.toLowerCase(),
    item: { id, name, quality: quality.data },
  };
}

/** Where a recipe is learned; recipes without a recipe item are taught by trainers. */
export function makeRecipeSources(
  get: GetGameData,
  items: ReadonlyMap<string, RecipeItem>,
  locale: ContentLocale,
) {
  const skills = new Map<number, number | undefined>();
  return async (name: string): Promise<RecipeSource> => {
    const item = items.get(name.toLowerCase());
    if (!item) return { kind: "trainer" };
    if (!skills.has(item.id)) {
      const detail = await get(wowForever.item(item.id), locale);
      skills.set(
        item.id,
        positiveInt(
          rec(rec(rec(detail?.preview_item).requirements).skill).level,
        ),
      );
    }
    const requiredSkill = skills.get(item.id);
    return {
      kind: "recipe-item",
      item,
      ...(requiredSkill === undefined ? {} : { requiredSkill }),
    };
  };
}
