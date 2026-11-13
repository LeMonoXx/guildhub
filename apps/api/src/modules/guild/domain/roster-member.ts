export type RankId = number & { readonly __brand: "RankId" };

export function rankId(value: number): RankId {
  return value as RankId;
}

export interface RosterMember {
  readonly characterId: string;
  readonly name: string;
  readonly surname: string;
  readonly level: number;
  readonly rankId: RankId;
  readonly classId: string;
  readonly raceId: string;
}

export const isGuildMaster = (member: RosterMember): boolean =>
  member.rankId === 0;
