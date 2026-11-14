import type { RosterMember } from "./roster-member.js";

export const FEATURED_MEMBER_LIMIT = 6;

/** Every member in featuring order: guild rank first, then name. */
export function rankFeaturedCandidates(
  members: readonly RosterMember[],
): RosterMember[] {
  return [...members].sort((left, right) => {
    if (left.rankId !== right.rankId) return left.rankId - right.rankId;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    const bySurname = left.surname.localeCompare(right.surname);
    if (bySurname !== 0) return bySurname;
    return left.characterId.localeCompare(right.characterId);
  });
}

export function selectFeaturedMembers(
  members: readonly RosterMember[],
  limit = FEATURED_MEMBER_LIMIT,
): RosterMember[] {
  return rankFeaturedCandidates(members).slice(0, limit);
}

/**
 * Prefers candidates that pass `isShowable`, keeping featuring order, and
 * fills the remaining places with the others.
 */
export function pickFeatured<T>(
  ranked: readonly T[],
  isShowable: (candidate: T) => boolean,
  limit = FEATURED_MEMBER_LIMIT,
): T[] {
  const showable = ranked.filter(isShowable);
  const rest = ranked.filter((candidate) => !isShowable(candidate));
  const chosen = new Set([...showable, ...rest].slice(0, limit));
  return ranked.filter((candidate) => chosen.has(candidate));
}
