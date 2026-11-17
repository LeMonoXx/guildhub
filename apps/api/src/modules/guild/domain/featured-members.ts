import type { RosterMember } from "./roster-member.js";

export const FEATURED_MEMBER_LIMIT = 8;

/** Every member in featuring order: named favorites first, then guild rank, then name. */
export function rankFeaturedCandidates(
  members: readonly RosterMember[],
  preferred: readonly string[] = [],
): RosterMember[] {
  const ranked = [...members].sort(byRank);
  const chosen: RosterMember[] = [];
  const seen = new Set<string>();
  for (const token of preferred) {
    const member = resolvePreferred(ranked, token, seen);
    if (member === undefined) continue;
    seen.add(member.characterId);
    chosen.push(member);
  }
  for (const member of ranked) {
    if (seen.has(member.characterId)) continue;
    chosen.push(member);
  }
  return chosen;
}

export function selectFeaturedMembers(
  members: readonly RosterMember[],
  limit = FEATURED_MEMBER_LIMIT,
  preferred: readonly string[] = [],
): RosterMember[] {
  return rankFeaturedCandidates(members, preferred).slice(0, limit);
}

function byRank(left: RosterMember, right: RosterMember): number {
  if (left.rankId !== right.rankId) return left.rankId - right.rankId;
  const byName = left.name.localeCompare(right.name);
  if (byName !== 0) return byName;
  const bySurname = left.surname.localeCompare(right.surname);
  if (bySurname !== 0) return bySurname;
  return left.characterId.localeCompare(right.characterId);
}

/** A slug, a full name, or a first name when only one member has it. */
function resolvePreferred(
  members: readonly RosterMember[],
  token: string,
  seen: ReadonlySet<string>,
): RosterMember | undefined {
  const key = token.trim().toLowerCase();
  if (key.length === 0) return undefined;
  const open = members.filter((member) => !seen.has(member.characterId));
  const slug = key.replace(/\s+/g, "-");
  const exact = open.filter(
    (member) =>
      member.slug === slug ||
      `${member.name} ${member.surname}`.toLowerCase() === key,
  );
  if (exact.length === 1) return exact[0];
  const byName = open.filter((member) => member.name.toLowerCase() === key);
  return byName.length === 1 ? byName[0] : undefined;
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
