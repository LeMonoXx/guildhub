import type { ContentLocale, RecipeSearchResponse } from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import {
  RecipeIndex,
  type CraftersByRecipe,
  type RecipeQuery,
} from "../domain/recipe-index.js";
import { LocaleMemo } from "./locale-memo.js";
import type { LoadGuildCrafters, RecipeCatalogStore } from "./ports.js";

export interface SearchRecipesDeps {
  readonly store: RecipeCatalogStore;
  readonly loadCrafters: LoadGuildCrafters;
  readonly clock: Clock;
  /** How long the catalog and the crafters stay in memory between reloads. */
  readonly reloadAfterMs: number;
}

export const makeSearchRecipes = (deps: SearchRecipesDeps) => {
  const now = () => deps.clock.now().getTime();
  const catalog = new LocaleMemo(
    async (locale) => {
      const loaded = await deps.store.load(locale);
      return loaded
        ? {
            index: new RecipeIndex(loaded.recipes),
            updatedAt: loaded.updatedAt,
          }
        : undefined;
    },
    now,
    deps.reloadAfterMs,
  );
  const crafters = new LocaleMemo(deps.loadCrafters, now, deps.reloadAfterMs);

  return async (
    query: RecipeQuery,
    locale: ContentLocale,
  ): Promise<RecipeSearchResponse> => {
    const loaded = await catalog.get(locale);
    if (!loaded)
      return {
        recipes: [],
        total: 0,
        offset: 0,
        professions: [],
        stats: [],
        catalogReady: false,
      };
    const byRecipe: CraftersByRecipe = loaded.index.craftersOf(
      await crafters.get(locale),
    );
    const page = loaded.index.search(query, byRecipe);
    return {
      ...page,
      offset: query.offset,
      professions: loaded.index.professions(),
      stats: loaded.index.stats(),
      catalogReady: true,
      updatedAt: loaded.updatedAt.toISOString(),
    };
  };
};

export type SearchRecipes = ReturnType<typeof makeSearchRecipes>;
