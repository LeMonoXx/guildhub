import type { ContentLocale } from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import { appError, type AppError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import { isCompleteEnough } from "../domain/catalog-completeness.js";
import type { RecipeCatalogSource, RecipeCatalogStore } from "./ports.js";

export interface RefreshRecipeCatalogDeps {
  readonly source: RecipeCatalogSource;
  readonly store: RecipeCatalogStore;
  readonly clock: Clock;
  /** Every language the site shows game texts in. */
  readonly locales: readonly ContentLocale[];
}

/** Rebuilds the recipe catalog of every language; a failed or partial fetch keeps the previous one. */
export const makeRefreshRecipeCatalog =
  (deps: RefreshRecipeCatalogDeps) =>
  async (): Promise<Result<{ readonly recipes: number }, AppError>> => {
    let recipes = 0;
    for (const locale of deps.locales) {
      const fetched = await deps.source.fetchCatalog(locale);
      if (!fetched.ok) return fetched;
      const found = fetched.value.recipes.length;
      if (!isCompleteEnough(found, fetched.value.listed))
        return err(
          appError("upstream.unavailable", {
            detail: `only ${String(found)} of ${String(fetched.value.listed)} recipes answered`,
          }),
        );
      await deps.store.save(
        { recipes: fetched.value.recipes, updatedAt: deps.clock.now() },
        locale,
      );
      recipes = Math.max(recipes, found);
    }
    return ok({ recipes });
  };

export type RefreshRecipeCatalog = ReturnType<typeof makeRefreshRecipeCatalog>;
