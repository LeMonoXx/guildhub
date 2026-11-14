import {
  defaultContentLocale,
  recipeSchema,
  type ContentLocale,
} from "@guildhub/contracts";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../platform/db/client.js";
import type {
  RecipeCatalog,
  RecipeCatalogStore,
} from "../application/ports.js";
import { recipeCatalog } from "./schema.js";

const recipesSchema = z.array(recipeSchema);
const catalogId = (locale: ContentLocale) => `recipes-${locale}`;

export function makeDrizzleRecipeCatalogStore(
  database: Database,
): RecipeCatalogStore {
  const read = async (
    locale: ContentLocale,
  ): Promise<RecipeCatalog | undefined> => {
    const [row] = await database.db
      .select()
      .from(recipeCatalog)
      .where(eq(recipeCatalog.id, catalogId(locale)))
      .limit(1);
    if (!row) return undefined;
    const recipes = recipesSchema.safeParse(row.recipes);
    return recipes.success
      ? { recipes: recipes.data, updatedAt: row.updatedAt }
      : undefined;
  };
  return {
    load: async (locale) =>
      (await read(locale)) ?? (await read(defaultContentLocale)),
    save: async (catalog, locale) => {
      const row = {
        id: catalogId(locale),
        recipes: catalog.recipes,
        updatedAt: catalog.updatedAt,
      };
      await database.db
        .insert(recipeCatalog)
        .values(row)
        .onConflictDoUpdate({ target: recipeCatalog.id, set: row });
    },
  };
}
