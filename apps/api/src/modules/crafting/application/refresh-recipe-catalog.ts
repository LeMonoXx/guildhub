import type { ContentLocale } from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import type { AppError } from "../../../platform/kernel/app-error.js";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type { RecipeCatalogSource, RecipeCatalogStore } from "./ports.js";

export interface RefreshRecipeCatalogDeps {
  readonly source: RecipeCatalogSource;
  readonly store: RecipeCatalogStore;
  readonly clock: Clock;
  /** Every language the site shows game texts in. */
  readonly locales: readonly ContentLocale[];
}

/** Rebuilds the recipe catalog of every language; a failed fetch keeps the previous one. */
export const makeRefreshRecipeCatalog =
  (deps: RefreshRecipeCatalogDeps) =>
  async (): Promise<Result<{ readonly recipes: number }, AppError>> => {
    let recipes = 0;
    for (const locale of deps.locales) {
      const fetched = await deps.source.fetchCatalog(locale);
      if (!fetched.ok) return fetched;
      await deps.store.save(
        { recipes: fetched.value, updatedAt: deps.clock.now() },
        locale,
      );
      recipes = Math.max(recipes, fetched.value.length);
    }
    return ok({ recipes });
  };

export type RefreshRecipeCatalog = ReturnType<typeof makeRefreshRecipeCatalog>;
