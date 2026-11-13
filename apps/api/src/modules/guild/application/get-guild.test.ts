import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import type { GuildRef } from "../domain/guild-ref.js";
import type { RosterMember } from "../domain/roster-member.js";
import type { GuildSnapshot } from "../domain/snapshot.js";
import { makeGetGuild } from "./get-guild.js";
import type { GuildCache, GuildSource } from "./ports.js";

const guild: GuildRef = { slug: "example-guild" };
const profile: GuildProfile = {
  id: "1",
  slug: "example-guild",
  name: "Example Guild",
  faction: "ALLIANCE",
  achievementPoints: 0,
  memberCount: 2,
};
const now = new Date("2026-11-13T12:00:00.000Z");
const staleFetchedAt = new Date("2026-11-13T11:00:00.000Z");

class MemoryCache implements GuildCache {
  profile: GuildSnapshot<GuildProfile> | undefined;
  roster: GuildSnapshot<readonly RosterMember[]> | undefined;

  latestProfile(): Promise<GuildSnapshot<GuildProfile> | undefined> {
    return Promise.resolve(this.profile);
  }

  latestRoster(): Promise<GuildSnapshot<readonly RosterMember[]> | undefined> {
    return Promise.resolve(this.roster);
  }

  saveProfile(snapshot: GuildSnapshot<GuildProfile>): Promise<void> {
    this.profile = snapshot;
    return Promise.resolve();
  }

  saveRoster(snapshot: GuildSnapshot<readonly RosterMember[]>): Promise<void> {
    this.roster = snapshot;
    return Promise.resolve();
  }
}

function source(
  result: Awaited<ReturnType<GuildSource["fetchProfile"]>>,
): GuildSource {
  return {
    fetchProfile: () => Promise.resolve(result),
    fetchRoster: () => Promise.resolve(err(appError("upstream.unavailable"))),
  };
}

function getGuild(
  cache: MemoryCache,
  result: Awaited<ReturnType<GuildSource["fetchProfile"]>>,
) {
  return makeGetGuild({
    source: source(result),
    cache,
    clock: { now: () => now },
    maxAgeMs: 60_000,
  });
}

describe("get-guild", () => {
  it("returns a fresh cache hit without calling the source", async () => {
    const cache = new MemoryCache();
    cache.profile = { guild, fetchedAt: now, payload: profile };
    const calls = { profile: 0 };
    const useCase = makeGetGuild({
      source: {
        fetchProfile: () => {
          calls.profile += 1;
          return Promise.resolve(ok(profile));
        },
        fetchRoster: () =>
          Promise.resolve(err(appError("upstream.unavailable"))),
      },
      cache,
      clock: { now: () => now },
      maxAgeMs: 60_000,
    });

    const result = await useCase(guild);
    expect(result).toEqual({
      ok: true,
      value: { data: profile, fetchedAt: now, stale: false },
    });
    expect(calls.profile).toBe(0);
  });

  it("fills an empty cache from the source", async () => {
    const cache = new MemoryCache();
    const result = await getGuild(cache, ok(profile))(guild);
    expect(result).toEqual({
      ok: true,
      value: { data: profile, fetchedAt: now, stale: false },
    });
    expect(cache.profile?.payload).toEqual(profile);
  });

  it("refreshes a stale cache", async () => {
    const cache = new MemoryCache();
    cache.profile = { guild, fetchedAt: staleFetchedAt, payload: profile };
    const refreshed = { ...profile, memberCount: 3 };
    const result = await getGuild(cache, ok(refreshed))(guild);
    expect(result.ok && result.value.data.memberCount).toBe(3);
    expect(result.ok && result.value.stale).toBe(false);
    expect(cache.profile.fetchedAt).toEqual(now);
  });

  it("serves stale cache when upstream fails", async () => {
    const cache = new MemoryCache();
    cache.profile = { guild, fetchedAt: staleFetchedAt, payload: profile };
    const result = await getGuild(
      cache,
      err(appError("upstream.unavailable")),
    )(guild);
    expect(result).toEqual({
      ok: true,
      value: { data: profile, fetchedAt: staleFetchedAt, stale: true },
    });
  });

  it("returns upstream.unavailable when the cache is empty", async () => {
    const cache = new MemoryCache();
    const result = await getGuild(
      cache,
      err(appError("upstream.unavailable")),
    )(guild);
    expect(result).toEqual({
      ok: false,
      error: { code: "upstream.unavailable" },
    });
  });

  it("returns guild.not_found when the source does", async () => {
    const cache = new MemoryCache();
    const result = await getGuild(
      cache,
      err(appError("guild.not_found")),
    )(guild);
    expect(result).toEqual({
      ok: false,
      error: { code: "guild.not_found" },
    });
  });
});
