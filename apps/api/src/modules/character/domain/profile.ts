import type { CharacterProfile } from "@guildhub/contracts";

/** Everything Battle.net publishes about one character, already normalized. */
export type CharacterProfileData = Omit<
  CharacterProfile,
  "characterId" | "slug" | "status"
>;

export interface CharacterProfileSnapshot {
  readonly characterId: string;
  readonly slug: string;
  readonly status: CharacterProfile["status"];
  readonly data: CharacterProfileData;
  readonly fetchedAt: Date;
}

export function emptyProfileData(level: number): CharacterProfileData {
  return {
    summary: { level, achievementPoints: 0 },
    equipment: [],
    specializations: [],
    professions: [],
    reputations: [],
    titles: [],
    achievements: {
      total: 0,
      points: 0,
      recent: [],
      categories: [],
      inProgress: [],
    },
    statisticGroups: [],
    collections: { mounts: [], pets: [], toys: [], heirlooms: [] },
    hunterPets: [],
    quests: { inProgress: [], completedCount: 0, recentCompleted: [] },
  };
}
