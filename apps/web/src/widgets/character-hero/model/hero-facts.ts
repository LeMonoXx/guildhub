import type { CharacterProfileResponse } from "@guildhub/contracts";

export interface HeroFact {
  readonly key: string;
  readonly value: number;
}

/** The headline numbers the profile knows; unknown ones are left out. */
export const heroFacts = (
  profile: CharacterProfileResponse | undefined,
): HeroFact[] => {
  const summary = profile?.summary;
  return [
    {
      key: "itemLevel",
      value: summary?.equippedItemLevel ?? summary?.averageItemLevel,
    },
    { key: "achievementPoints", value: profile?.achievements.points },
    { key: "questsCompleted", value: profile?.quests.completedCount },
    { key: "honorableKills", value: profile?.pvp?.honorableKills },
    { key: "mounts", value: profile?.collections.mounts.length },
    { key: "companions", value: profile?.collections.pets.length },
  ].filter((fact): fact is HeroFact => fact.value !== undefined);
};
