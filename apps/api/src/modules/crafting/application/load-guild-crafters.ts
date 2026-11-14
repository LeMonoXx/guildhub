import type { LoadMemberProfiles } from "../../character/index.js";
import type { GetGuildRoster, GuildRef } from "../../guild/index.js";
import type { CrafterProfile } from "../domain/recipe-index.js";
import type { LoadGuildCrafters } from "./ports.js";

export interface LoadGuildCraftersDeps {
  readonly guild: GuildRef;
  readonly getRoster: GetGuildRoster;
  readonly loadProfiles: LoadMemberProfiles;
}

/** Members with a published profile and their professions. */
export const makeLoadGuildCrafters =
  (deps: LoadGuildCraftersDeps): LoadGuildCrafters =>
  async (locale) => {
    const roster = await deps.getRoster(deps.guild);
    if (!roster.ok) return [];
    const profiles = await deps.loadProfiles(roster.value.data, locale);
    return profiles.flatMap(({ member, profile }): CrafterProfile[] =>
      profile.status === "available"
        ? [
            {
              crafter: {
                characterId: member.characterId,
                slug: member.slug,
                name: member.name,
                classId: member.classId,
              },
              professions: profile.data.professions.map((profession) => ({
                id: profession.id,
                skill: profession.skill,
                recipeIds: profession.recipeIds,
                recipes: profession.recipes,
              })),
            },
          ]
        : [],
    );
  };
