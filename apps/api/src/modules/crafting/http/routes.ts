import {
  recipeSearchQuerySchema,
  recipeSearchResponseSchema,
} from "@guildhub/contracts";
import type { Hono } from "hono";
import type { AppEnv } from "../../../platform/http/app.js";
import { requestLocale } from "../../../platform/http/content-locale.js";
import { problemResponse } from "../../../platform/http/problems.js";
import { appError } from "../../../platform/kernel/app-error.js";
import type { SearchRecipes } from "../application/search-recipes.js";

export interface RegisterCraftingDeps {
  readonly searchRecipes: SearchRecipes;
}

const CACHE = "public, max-age=300";

export function registerCrafting(
  app: Hono<AppEnv>,
  deps: RegisterCraftingDeps,
): void {
  app.get("/api/guild/recipes", async (context) => {
    const query = recipeSearchQuerySchema.safeParse(context.req.query());
    if (!query.success)
      return problemResponse(context, appError("request.invalid"));
    const { q, profession, stat, known, offset } = query.data;
    const response = recipeSearchResponseSchema.parse(
      await deps.searchRecipes(
        {
          text: q,
          professionId: profession,
          stat,
          knownOnly: known,
          offset,
        },
        requestLocale(context),
      ),
    );
    context.header("Cache-Control", CACHE);
    return context.json(response);
  });
}
