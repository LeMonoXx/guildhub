import {
  recipeSearchResponseSchema,
  type RecipeSearchResponse,
} from "@guildhub/contracts";
import { getJson } from "../../../shared/api";

export interface RecipeSearch {
  readonly q?: string;
  readonly profession?: number;
  readonly stat?: string;
  readonly known?: boolean;
  readonly offset?: number;
}

export interface RecipeDataSource {
  search(query: RecipeSearch): Promise<RecipeSearchResponse>;
}

export const recipeSearchPath = (query: RecipeSearch): string => {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set("q", q);
  if (query.profession !== undefined)
    params.set("profession", String(query.profession));
  if (query.stat) params.set("stat", query.stat);
  if (query.known) params.set("known", "1");
  if (query.offset) params.set("offset", String(query.offset));
  const search = params.toString();
  return search ? `/api/guild/recipes?${search}` : "/api/guild/recipes";
};

export const createHttpRecipeSource = (): RecipeDataSource => ({
  search: (query) =>
    getJson(recipeSearchPath(query), recipeSearchResponseSchema),
});

export const recipeKeys = {
  all: ["recipes"] as const,
  search: (query: RecipeSearch) =>
    [...recipeKeys.all, "search", query] as const,
};

export const recipeQueries = (source: RecipeDataSource) => ({
  search: (query: RecipeSearch) => ({
    queryKey: recipeKeys.search(query),
    queryFn: () => source.search(query),
    staleTime: 5 * 60_000,
  }),
});
