import type { CharacterProfile, GuildFaction } from "@guildhub/contracts";

/** The roster facts the party planner reads about a member. */
export interface PartyMemberFacts {
  readonly slug: string;
  readonly name: string;
  readonly surname: string;
  readonly level: number;
  readonly classId: string;
}

export type PartyProfile = Pick<
  CharacterProfile,
  "summary" | "quests" | "avatarUrl"
>;

export interface PartyEntry {
  readonly member: PartyMemberFacts;
  readonly available: boolean;
  readonly profile: PartyProfile;
}

export type { GuildFaction };
