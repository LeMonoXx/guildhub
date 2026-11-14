import type { ContentLocale, RecipeSearchResponse } from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import {
  RecipeIndex,
  type CraftersByRecipe,
  type RecipeQuery,
} from "../domain/recipe-index.js";
import type { LoadGuildCrafters, RecipeCatalogStore } from "./ports.js";

export interface SearchRecipesDeps {
  readonly store: RecipeCatalogStore;
  readonly loadCrafters: LoadGuildCrafters;
  readonly clock: Clock;
  /** How long the catalog and the crafters stay in memory between reloads. */
  readonly reloadAfterMs: number;
}

interface Loaded<T> {
  readonly value: T;
  readonly loadedAt: number;
}

/** Keeps one value in memory and reloads it once it is older than `maxAgeMs`. */
class Memo<T> {
  private current: Loaded<T> | undefined;
  private pending: Promise<T> | undefined;

  constructor(
    private readonly load: () => Promise<T>,
    private readonly now: () => number,
    private readonly maxAgeMs: number,
  ) {}

  async get(): Promise<T> {
    const current = this.current;
    if (current && this.now() - current.loadedAt < this.maxAgeMs)
      return current.value;
    this.pending ??= this.load()
      .then((value) => {
        this.current = { value, loadedAt: this.now() };
        return value;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }
}

/** One memo per language. */
class LocaleMemo<T> {
  private readonly byLocale = new Map<ContentLocale, Memo<T>>();

  constructor(
    private readonly load: (locale: ContentLocale) => Promise<T>,
    private readonly now: () => number,
    private readonly maxAgeMs: number,
  ) {}

  get(locale: ContentLocale): Promise<T> {
    let memo = this.byLocale.get(locale);
    if (!memo) {
      memo = new Memo(() => this.load(locale), this.now, this.maxAgeMs);
      this.byLocale.set(locale, memo);
    }
    return memo.get();
  }
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
