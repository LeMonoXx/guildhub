import type { RecipeSearch } from "../api/client";

export interface RecipeFilters {
  readonly q?: string | undefined;
  readonly profession?: number | undefined;
  readonly stat?: string | undefined;
  readonly known?: boolean | undefined;
  readonly page?: number | undefined;
}

export const RECIPES_PER_PAGE = 40;

/** The router parses search values as JSON, so "1" arrives as a number. */
const text = (value: unknown): string | undefined => {
  const raw = typeof value === "number" ? String(value) : value;
  return typeof raw === "string" && raw.trim() !== "" ? raw : undefined;
};

const flag = (value: unknown): true | undefined =>
  [true, 1, "1", "true"].includes(value as never) ? true : undefined;

const positive = (value: unknown): number | undefined => {
  const number = typeof value === "number" ? value : Number(text(value));
  return Number.isInteger(number) && number > 0 ? number : undefined;
};

/** Router search validation: unknown or broken params fall away. */
export const parseRecipeFilters = (
  search: Record<string, unknown>,
): RecipeFilters => ({
  q: text(search.q),
  profession: positive(search.profession),
  stat: text(search.stat),
  known: flag(search.known),
  page: positive(search.page),
});

export const toRecipeSearch = (filters: RecipeFilters): RecipeSearch => ({
  q: filters.q,
  profession: filters.profession,
  stat: filters.stat,
  known: filters.known,
  offset: ((filters.page ?? 1) - 1) * RECIPES_PER_PAGE,
});

/** A changed filter starts again on the first page. */
export const withFilter = (
  filters: RecipeFilters,
  change: Omit<RecipeFilters, "page">,
): RecipeFilters => ({ ...filters, ...change, page: undefined });
