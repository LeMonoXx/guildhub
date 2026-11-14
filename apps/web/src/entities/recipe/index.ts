import {
  createHttpRecipeSource,
  recipeQueries as createRecipeQueries,
} from "./api/client";

export const recipeSource = createHttpRecipeSource();
export const recipeQueries = createRecipeQueries(recipeSource);
export { recipeKeys, recipeSearchPath } from "./api/client";
export type { RecipeDataSource, RecipeSearch } from "./api/client";
export {
  parseRecipeFilters,
  RECIPES_PER_PAGE,
  toRecipeSearch,
  withFilter,
  type RecipeFilters,
} from "./model/recipe-filters";
