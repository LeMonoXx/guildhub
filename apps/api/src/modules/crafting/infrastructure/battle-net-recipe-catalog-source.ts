import type { BlizzardApiClient } from "@blizzard-api/client";
import { wowForever } from "@blizzard-api/wow-forever";
import {
  itemQualitySchema,
  type CraftedItem,
  type ItemQuality,
  type Recipe,
  type RecipeSource,
  type RecipeStat,
  type ContentLocale,
} from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import {
  battleNetLocaleOf,
  mapLimited,
  sendBattleNetPatiently,
  type BattleNetResource,
} from "../../character/index.js";
import type { RecipeCatalogSource } from "../application/ports.js";

/** Leaves room for profile refreshes that share the same API quota. */
const REQUEST_CONCURRENCY = 4;
const SEARCH_PAGE_SIZE = 1000;
const RECIPE_ITEM_CLASS = 9;
/** A rebuild that loses more than this share of recipes keeps the old catalog. */
const MIN_COMPLETENESS = 0.8;

interface ListedRecipe {
  readonly id: number;
  readonly professionId: number;
  readonly profession: string;
  readonly category: string;
}

interface RecipeItem {
  readonly id: number;
  readonly name: string;
  readonly quality: ItemQuality;
}

/**
 * Walks every profession's skill tiers for the recipe list, then reads each
 * recipe, its icon and its crafted item. Recipe items ("Recipe: …",
 * "Pattern: …") are matched to recipes by name; recipes without one are
 * taught by trainers.
 */
export function makeBattleNetRecipeCatalogSource(
  client: BlizzardApiClient,
  iconUrl: (iconId: number) => string,
): RecipeCatalogSource {
  const get = async (
    resource: BattleNetResource,
    locale: ContentLocale,
  ): Promise<Record<string, unknown> | undefined> => {
    const result = await sendBattleNetPatiently(client, resource, { locale });
    return result.ok ? rec(result.value) : undefined;
  };

  const listRecipes = async (
    locale: ContentLocale,
  ): Promise<ListedRecipe[] | undefined> => {
    const index = await get(wowForever.professionIndex(), locale);
    if (!index) return undefined;
    const professions = list(index.professions)
      .map(rec)
      .filter((entry) => !str(entry.name)?.includes("[DNT]"));
    const tiers = (
      await mapLimited(professions, REQUEST_CONCURRENCY, async (entry) => {
        const professionId = int(entry.id);
        const profession =
          professionId === undefined
            ? undefined
            : await get(wowForever.profession(professionId), locale);
        return list(profession?.skill_tiers).map((tier) => ({
          professionId: professionId ?? 0,
          profession: str(profession?.name) ?? str(entry.name) ?? "",
          tierId: int(rec(tier).id),
        }));
      })
    ).flat();
    const listed = await mapLimited(
      tiers,
      REQUEST_CONCURRENCY,
      async (tier) => {
        if (tier.tierId === undefined) return [];
        const body = await get(
          wowForever.professionSkillTier(tier.professionId, tier.tierId),
          locale,
        );
        return list(body?.categories).flatMap((category) =>
          list(rec(category).recipes).flatMap((recipe) => {
            const id = int(rec(recipe).id);
            return id === undefined
              ? []
              : [
                  {
                    id,
                    professionId: tier.professionId,
                    profession: tier.profession,
                    category: str(rec(category).name) ?? "",
                  },
                ];
          }),
        );
      },
    );
    const unique = new Map(listed.flat().map((recipe) => [recipe.id, recipe]));
    return [...unique.values()];
  };

  const recipeItems = async (
    locale: ContentLocale,
  ): Promise<Map<string, RecipeItem>> => {
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
      const results = list(body?.results).map((result) =>
        rec(rec(result).data),
      );
      for (const data of results) {
        const id = int(data.id);
        const name = str(rec(data.name)[battleNetLocaleOf(locale)]);
        const quality = itemQualitySchema.safeParse(rec(data.quality).type);
        const taught = name?.split(": ").slice(1).join(": ");
        if (
          id === undefined ||
          name === undefined ||
          !taught ||
          !quality.success
        )
          continue;
        byTaughtName.set(taught.toLowerCase(), {
          id,
          name,
          quality: quality.data,
        });
      }
      const last = Math.max(0, ...results.map((data) => int(data.id) ?? 0));
      if (results.length < SEARCH_PAGE_SIZE || last < from) break;
      from = last + 1;
    }
    return byTaughtName;
  };

  const sourceOf = async (
    name: string,
    items: ReadonlyMap<string, RecipeItem>,
    skills: Map<number, number | undefined>,
    locale: ContentLocale,
  ): Promise<RecipeSource> => {
    const item = items.get(name.toLowerCase());
    if (!item) return { kind: "trainer" };
    if (!skills.has(item.id)) {
      const detail = await get(wowForever.item(item.id), locale);
      skills.set(
        item.id,
        int(rec(rec(rec(detail?.preview_item).requirements).skill).level),
      );
    }
    const requiredSkill = skills.get(item.id);
    return {
      kind: "recipe-item",
      item,
      ...(requiredSkill === undefined ? {} : { requiredSkill }),
    };
  };

  return {
    fetchCatalog: async (locale) => {
      const listed = await listRecipes(locale);
      if (!listed || listed.length === 0)
        return err(
          appError("upstream.unavailable", { detail: "no recipe list" }),
        );
      const items = await recipeItems(locale);
      const skills = new Map<number, number | undefined>();
      const recipes = await mapLimited(
        listed,
        REQUEST_CONCURRENCY,
        async (entry): Promise<Recipe | undefined> => {
          const [body, media] = await Promise.all([
            get(wowForever.recipe(entry.id), locale),
            get(wowForever.recipeMedia(entry.id), locale),
          ]);
          const name = str(body?.name);
          if (!body || !name) return undefined;
          const icon = iconIdOf(media);
          const crafted = rec(body.crafted_item);
          const craftedId = int(crafted.id);
          const craftedItem =
            craftedId === undefined
              ? undefined
              : craftedItemOf(
                  craftedId,
                  await get(wowForever.item(craftedId), locale),
                  icon,
                  iconUrl,
                );
          return {
            id: entry.id,
            name,
            professionId: entry.professionId,
            profession: entry.profession,
            category: entry.category || entry.profession,
            ...(icon === undefined ? {} : { iconUrl: iconUrl(icon) }),
            ...(craftedItem === undefined ? {} : { craftedItem }),
            craftedQuantity: Math.max(
              1,
              int(rec(body.crafted_quantity).value) ?? 1,
            ),
            reagents: list(body.reagents).flatMap((reagent) => {
              const record = rec(reagent);
              const itemId = int(rec(record.reagent).id);
              const reagentName = str(rec(record.reagent).name);
              const quantity = int(record.quantity);
              return itemId === undefined ||
                reagentName === undefined ||
                quantity === undefined
                ? []
                : [{ itemId, name: reagentName, quantity }];
            }),
            source: await sourceOf(name, items, skills, locale),
          };
        },
      );
      const found = recipes.filter(
        (recipe): recipe is Recipe => recipe !== undefined,
      );
      if (found.length < listed.length * MIN_COMPLETENESS)
        return err(
          appError("upstream.unavailable", {
            detail: `only ${String(found.length)} of ${String(listed.length)} recipes answered`,
          }),
        );
      return ok(found);
    },
  };
}

function craftedItemOf(
  id: number,
  body: Record<string, unknown> | undefined,
  icon: number | undefined,
  iconUrl: (iconId: number) => string,
): CraftedItem | undefined {
  const name = str(body?.name);
  const quality = itemQualitySchema.safeParse(rec(body?.quality).type);
  if (!body || !name || !quality.success) return undefined;
  const preview = rec(body.preview_item);
  const slot = rec(body.inventory_type);
  const itemLevel = int(body.level);
  return {
    id,
    name,
    quality: quality.data,
    ...(icon === undefined ? {} : { iconUrl: iconUrl(icon) }),
    ...(itemLevel === undefined ? {} : { itemLevel }),
    ...(slot.type === "NON_EQUIP" || str(slot.name) === undefined
      ? {}
      : { slot: str(slot.name) }),
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

function iconIdOf(
  media: Record<string, unknown> | undefined,
): number | undefined {
  const icon = list(media?.assets)
    .map(rec)
    .find((asset) => asset.key === "icon");
  return int(icon?.file_data_id);
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function int(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}
