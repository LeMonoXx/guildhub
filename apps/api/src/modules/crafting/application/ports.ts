import type { ContentLocale, Recipe } from "@guildhub/contracts";
import type { Result } from "../../../platform/kernel/result.js";
import type { AppError } from "../../../platform/kernel/app-error.js";
import type { CrafterProfile } from "../domain/recipe-index.js";

export interface RecipeCatalog {
  readonly recipes: readonly Recipe[];
  readonly updatedAt: Date;
}

/** One catalog per language, since it holds game texts. */
export interface RecipeCatalogStore {
  load(locale: ContentLocale): Promise<RecipeCatalog | undefined>;
  /** Replaces the whole catalog of that language. */
  save(catalog: RecipeCatalog, locale: ContentLocale): Promise<void>;
}

export interface FetchedCatalog {
  readonly recipes: Recipe[];
  /** How many recipes the game lists; some may not have answered. */
  readonly listed: number;
}

/** Every craftable recipe of the game, built from static game data. */
export interface RecipeCatalogSource {
  fetchCatalog(
    locale: ContentLocale,
  ): Promise<Result<FetchedCatalog, AppError>>;
}

/** The guild's members and what they can craft. */
export type LoadGuildCrafters = (
  locale: ContentLocale,
) => Promise<readonly CrafterProfile[]>;
