import type { ContentLocale } from "@guildhub/contracts";
import type { Clock } from "../../../platform/kernel/clock.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { isFresh, type RosterMember } from "../../guild/index.js";
import {
  emptyProfileData,
  type CharacterProfileSnapshot,
} from "../domain/profile.js";
import { toRef } from "./load-character-view.js";
import type { CharacterProfileCache, CharacterProfileSource } from "./ports.js";

const FETCH_CONCURRENCY = 3;

export interface ProfileDeps {
  readonly source: CharacterProfileSource;
  readonly cache: CharacterProfileCache;
  readonly clock: Clock;
  readonly maxAgeMs: number;
}

export interface MemberProfile {
  readonly member: RosterMember;
  readonly profile: CharacterProfileSnapshot;
}

/**
 * Loads one profile per member from the cache, refreshing stale or missing
 * ones from Battle.net. Unpublished characters are cached as `unavailable`
 * so they are not asked for again until the cache expires.
 */
export async function loadMemberProfiles(
  deps: ProfileDeps,
  members: readonly RosterMember[],
  locale: ContentLocale,
): Promise<MemberProfile[]> {
  const cached = new Map(
    (
      await deps.cache.latestMany(
        members.map((m) => m.characterId),
        locale,
      )
    ).map((snapshot) => [snapshot.characterId, snapshot]),
  );
  const now = deps.clock.now();
  return mapLimited(members, FETCH_CONCURRENCY, async (member) => {
    const hit = cached.get(member.characterId);
    if (hit !== undefined && isFresh(hit.fetchedAt, now, deps.maxAgeMs))
      return { member, profile: hit };
    return { member, profile: await refresh(deps, member, hit, locale) };
  });
}

async function refresh(
  deps: ProfileDeps,
  member: RosterMember,
  previous: CharacterProfileSnapshot | undefined,
  locale: ContentLocale,
): Promise<CharacterProfileSnapshot> {
  const now = deps.clock.now();
  const fetched = await deps.source.fetchProfile(toRef(member), locale);
  if (fetched.ok) {
    const snapshot: CharacterProfileSnapshot = {
      characterId: member.characterId,
      slug: member.slug,
      status: "available",
      data: {
        ...fetched.value,
        summary: {
          ...fetched.value.summary,
          level: fetched.value.summary?.level ?? member.level,
          achievementPoints: fetched.value.summary?.achievementPoints ?? 0,
        },
      },
      fetchedAt: now,
    };
    await deps.cache.save(snapshot, locale);
    return snapshot;
  }
  const unavailable: CharacterProfileSnapshot = {
    characterId: member.characterId,
    slug: member.slug,
    status: "unavailable",
    data: emptyProfileData(member.level),
    fetchedAt: now,
  };
  if (fetched.error.code === "character.not_found") {
    await deps.cache.save(unavailable, locale);
    return unavailable;
  }
  return previous ?? unavailable;
}

export const makeLoadMemberProfiles =
  (deps: ProfileDeps) =>
  (members: readonly RosterMember[], locale: ContentLocale) =>
    loadMemberProfiles(deps, members, locale);

export type LoadMemberProfiles = ReturnType<typeof makeLoadMemberProfiles>;
