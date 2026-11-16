import { wowForever } from "@blizzard-api/wow-forever";
import type { ContentLocale } from "@guildhub/contracts";
import {
  list,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import {
  REQUEST_CONCURRENCY,
  type GetGameData,
} from "./battle-net-game-data.js";

export interface ListedRecipe {
  readonly id: number;
  readonly professionId: number;
  readonly profession: string;
  readonly category: string;
}

interface SkillTier {
  readonly professionId: number;
  readonly profession: string;
  readonly tierId: number | undefined;
}

/** Every recipe of every profession, walked through the professions' skill tiers. */
export async function listRecipes(
  get: GetGameData,
  locale: ContentLocale,
): Promise<ListedRecipe[] | undefined> {
  const index = await get(wowForever.professionIndex(), locale);
  if (!index) return undefined;
  const professions = list(index.professions)
    .map(rec)
    .filter((entry) => !str(entry.name)?.includes("[DNT]"));
  const tiers = (
    await mapLimited(professions, REQUEST_CONCURRENCY, (entry) =>
      skillTiersOf(get, entry, locale),
    )
  ).flat();
  const listed = await mapLimited(tiers, REQUEST_CONCURRENCY, (tier) =>
    recipesOf(get, tier, locale),
  );
  const unique = new Map(listed.flat().map((recipe) => [recipe.id, recipe]));
  return [...unique.values()];
}

async function skillTiersOf(
  get: GetGameData,
  entry: Record<string, unknown>,
  locale: ContentLocale,
): Promise<SkillTier[]> {
  const professionId = positiveInt(entry.id);
  if (professionId === undefined) return [];
  const profession = await get(wowForever.profession(professionId), locale);
  return list(profession?.skill_tiers).map((tier) => ({
    professionId,
    profession: str(profession?.name) ?? str(entry.name) ?? "",
    tierId: positiveInt(rec(tier).id),
  }));
}

async function recipesOf(
  get: GetGameData,
  tier: SkillTier,
  locale: ContentLocale,
): Promise<ListedRecipe[]> {
  if (tier.tierId === undefined) return [];
  const body = await get(
    wowForever.professionSkillTier(tier.professionId, tier.tierId),
    locale,
  );
  return list(body?.categories).flatMap((category) =>
    list(rec(category).recipes).flatMap((recipe) => {
      const id = positiveInt(rec(recipe).id);
      return id === undefined
        ? []
        : [
            {
              id,
              professionId: tier.professionId,
              profession: tier.profession,
              category: str(rec(category).name) ?? "",
            },
          ];
    }),
  );
}
