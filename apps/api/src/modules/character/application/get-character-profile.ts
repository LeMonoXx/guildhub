import type { ContentLocale } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import type { Clock } from "../../../platform/kernel/clock.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import {
  isFresh,
  type GetGuildRoster,
  type GuildRef,
  type GuildSourceError,
  type GuildView,
  type RosterMember,
} from "../../guild/index.js";
import {
  emptyProfileData,
  type CharacterProfileSnapshot,
} from "../domain/profile.js";
import { toRef } from "./get-character.js";
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

export type GetCharacterProfileResult = Result<
  GuildView<MemberProfile>,
  GuildSourceError | ReturnType<typeof appError<"character.not_found">>
>;

export const makeGetCharacterProfile =
  (deps: ProfileDeps & { getRoster: GetGuildRoster }) =>
  async (query: {
    guild: GuildRef;
    slug: string;
    locale: ContentLocale;
  }): Promise<GetCharacterProfileResult> => {
    const roster = await deps.getRoster(query.guild);
    if (!roster.ok) return roster;
    const member = roster.value.data.find((item) => item.slug === query.slug);
    if (member === undefined) return err(appError("character.not_found"));
    const [profile] = await loadMemberProfiles(deps, [member], query.locale);
    if (profile === undefined) return err(appError("character.not_found"));
    return ok({
      data: profile,
      fetchedAt: profile.profile.fetchedAt,
      stale: roster.value.stale,
    });
  };

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
  const results = new Array<MemberProfile>(members.length);
  const queue = members.map((member, index) => ({ member, index }));
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { member, index } = next;
      const hit = cached.get(member.characterId);
      if (hit !== undefined && isFresh(hit.fetchedAt, now, deps.maxAgeMs)) {
        results[index] = { member, profile: hit };
        continue;
      }
      results[index] = {
        member,
        profile: await refresh(deps, member, hit, locale),
      };
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, members.length) }, worker),
  );
  return results;
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

export type GetCharacterProfile = ReturnType<typeof makeGetCharacterProfile>;
export type LoadMemberProfiles = ReturnType<typeof makeLoadMemberProfiles>;
