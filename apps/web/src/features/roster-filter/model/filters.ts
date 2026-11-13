import type { GuildRosterMember } from "@guildhub/contracts";

export interface RosterFilters {
  readonly q?: string;
  readonly classId?: string;
  readonly raceId?: string;
  readonly rankId?: number;
}

export const matchesRosterFilters = (
  member: GuildRosterMember,
  filters: RosterFilters,
): boolean => {
  const query = filters.q?.trim().toLowerCase();
  if (
    query &&
    !`${member.name} ${member.surname}`.toLowerCase().includes(query)
  )
    return false;
  if (filters.classId && member.classId !== filters.classId) return false;
  if (filters.raceId && member.raceId !== filters.raceId) return false;
  if (filters.rankId !== undefined && member.rankId !== filters.rankId)
    return false;
  return true;
};

export const uniqueSorted = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const parseRosterSearch = (
  search: Record<string, unknown>,
): RosterFilters => {
  const rankValue = search.rankId;
  return {
    q: typeof search.q === "string" ? search.q : undefined,
    classId: typeof search.classId === "string" ? search.classId : undefined,
    raceId: typeof search.raceId === "string" ? search.raceId : undefined,
    rankId:
      typeof rankValue === "number"
        ? rankValue
        : typeof rankValue === "string" && rankValue !== ""
          ? Number(rankValue)
          : undefined,
  };
};
