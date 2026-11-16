import type { GuildRosterMember } from "@guildhub/contracts";
import { searchNumber, stringValue } from "../../../shared/lib";

export interface RosterFilters {
  readonly q?: string;
  readonly classId?: string;
  readonly raceId?: string;
  readonly rankId?: number;
}

type RosterPredicate = (
  member: GuildRosterMember,
  filters: RosterFilters,
) => boolean;

const rosterPredicates: readonly RosterPredicate[] = [
  (member, { q }) => {
    const query = q?.trim().toLowerCase();
    return (
      !query || `${member.name} ${member.surname}`.toLowerCase().includes(query)
    );
  },
  (member, { classId }) => !classId || member.classId === classId,
  (member, { raceId }) => !raceId || member.raceId === raceId,
  (member, { rankId }) => rankId === undefined || member.rankId === rankId,
];

export const matchesRosterFilters = (
  member: GuildRosterMember,
  filters: RosterFilters,
): boolean => rosterPredicates.every((matches) => matches(member, filters));

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
