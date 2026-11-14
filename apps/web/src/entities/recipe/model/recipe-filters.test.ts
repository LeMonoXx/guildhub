import { describe, expect, it } from "vitest";
import { recipeSearchPath } from "../api/client";
import {
  parseRecipeFilters,
  RECIPES_PER_PAGE,
  toRecipeSearch,
  withFilter,
} from "./recipe-filters";

describe("recipe filters", () => {
  it("reads router search values, which may arrive JSON-parsed", () => {
    expect(
      parseRecipeFilters({
        q: 1234,
        profession: "171",
        known: 1,
        page: 2,
        stat: "",
      }),
    ).toEqual({
      q: "1234",
      profession: 171,
      stat: undefined,
      known: true,
      page: 2,
    });
    expect(
      parseRecipeFilters({ profession: -3, known: "no", page: "x" }),
    ).toEqual({
      q: undefined,
      profession: undefined,
      stat: undefined,
      known: undefined,
      page: undefined,
    });
  });

  it("turns pages into offsets and starts over when a filter changes", () => {
    expect(toRecipeSearch({ page: 3 }).offset).toBe(2 * RECIPES_PER_PAGE);
    expect(withFilter({ page: 3, q: "x" }, { stat: "STAMINA" })).toEqual({
      q: "x",
      stat: "STAMINA",
      page: undefined,
    });
  });

  it("builds the API path from the set filters only", () => {
    expect(recipeSearchPath({})).toBe("/api/guild/recipes");
    expect(
      recipeSearchPath({
        q: " giant growth ",
        profession: 171,
        known: true,
        offset: 40,
      }),
    ).toBe(
      "/api/guild/recipes?q=giant+growth&profession=171&known=1&offset=40",
    );
  });
});
