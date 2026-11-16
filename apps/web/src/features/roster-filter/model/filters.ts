import type { GuildRosterMember } from "@guildhub/contracts";
import { searchNumber, stringValue } from "../../../shared/lib";

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
  return {
    q: stringValue(search.q),
    classId: stringValue(search.classId),
    raceId: stringValue(search.raceId),
    rankId: searchNumber(search.rankId),
  };
};
