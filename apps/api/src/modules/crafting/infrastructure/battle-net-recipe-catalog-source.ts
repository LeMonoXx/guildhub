import type { BlizzardApiClient } from "@blizzard-api/client";
import { wowForever } from "@blizzard-api/wow-forever";
import type { ContentLocale, Recipe } from "@guildhub/contracts";
import {
  iconIdOf,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { RecipeCatalogSource } from "../application/ports.js";
import {
  makeGetGameData,
  REQUEST_CONCURRENCY,
  type GetGameData,
} from "./battle-net-game-data.js";
import { makeRecipeSources, recipeItems } from "./battle-net-recipe-items.js";
import { listRecipes, type ListedRecipe } from "./battle-net-recipe-listing.js";
import { mapCraftedItem, mapRecipe } from "./map-recipe.js";

/**
 * Lists every profession's recipes, then reads each recipe, its icon and its
 * crafted item, and where it is learned.
 */
export function makeBattleNetRecipeCatalogSource(
  client: BlizzardApiClient,
  iconUrl: (iconId: number) => string,
): RecipeCatalogSource {
  const get = makeGetGameData(client);
  return {
    fetchCatalog: async (locale) => {
      const listed = await listRecipes(get, locale);
      if (!listed || listed.length === 0)
        return err(
          appError("upstream.unavailable", { detail: "no recipe list" }),
        );
      const sourceOf = makeRecipeSources(
        get,
        await recipeItems(get, locale),
        locale,
      );
      const recipes = await mapLimited(
        listed,
        REQUEST_CONCURRENCY,
        async (entry): Promise<Recipe | undefined> => {
          const documents = await readRecipe(get, entry, locale, iconUrl);
          return (
            documents &&
            mapRecipe({ ...documents, source: await sourceOf(documents.name) })
          );
        },
      );
      return ok({
        recipes: recipes.filter(
          (recipe): recipe is Recipe => recipe !== undefined,
        ),
        listed: listed.length,
      });
    },
  };
}

async function readRecipe(
  get: GetGameData,
  listed: ListedRecipe,
  locale: ContentLocale,
  iconUrl: (iconId: number) => string,
) {
  const [body, media] = await Promise.all([
    get(wowForever.recipe(listed.id), locale),
    get(wowForever.recipeMedia(listed.id), locale),
  ]);
  const name = str(body?.name);
  if (!body || !name) return undefined;
  const icon = iconIdOf(media);
  const url = icon === undefined ? undefined : iconUrl(icon);
  const craftedId = positiveInt(rec(body.crafted_item).id);
  const craftedItem =
    craftedId === undefined
      ? undefined
      : mapCraftedItem(
          craftedId,
          await get(wowForever.item(craftedId), locale),
          url,
        );
  return { listed, name, body, iconUrl: url, craftedItem };
}
