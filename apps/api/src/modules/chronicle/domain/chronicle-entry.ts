import type { CharacterProfile } from "@guildhub/contracts";

/** The roster facts the chronicle reads about a member. */
export interface ChronicleMember {
  readonly characterId: string;
  readonly slug: string;
  readonly name: string;
  readonly surname: string;
  readonly level: number;
  readonly rankId: number;
  readonly classId: string;
  readonly raceId: string;
}

export type ChronicleProfile = Pick<
  CharacterProfile,
  | "summary"
  | "achievements"
  | "collections"
  | "reputations"
  | "professions"
  | "specializations"
  | "statisticGroups"
  | "quests"
  | "pvp"
  | "avatarUrl"
>;

export interface ChronicleEntry {
  readonly member: ChronicleMember;
  readonly available: boolean;
  readonly profile: ChronicleProfile;
}

/** Reputation tiers count up from Hated (0); Honored is 5, Exalted is 7. */
export const HONORED_TIER = 5;
export const EXALTED_TIER = 7;

export function ref(entry: ChronicleEntry) {
  return {
    slug: entry.member.slug,
    name: entry.member.name,
    surname: entry.member.surname,
    classId: entry.member.classId,
  };
}

export type MemberRef = ReturnType<typeof ref>;

export function itemLevel(entry: ChronicleEntry): number | undefined {
  const summary = entry.profile.summary;
  return summary?.equippedItemLevel ?? summary?.averageItemLevel;
}

export function questsCompleted(entry: ChronicleEntry): number {
  return entry.profile.quests.completedCount;
}

export function honorableKills(entry: ChronicleEntry): number {
  return entry.profile.pvp?.honorableKills ?? 0;
}

export function recipeCount(entry: ChronicleEntry): number {
  return sum(entry.profile.professions.map((p) => p.recipes.length));
}

export function reputationsAtLeast(
  entry: ChronicleEntry,
  tier: number,
): number {
  return entry.profile.reputations.filter((rep) => rep.tier >= tier).length;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
