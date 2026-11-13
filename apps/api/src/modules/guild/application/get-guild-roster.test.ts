import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import type { GuildRef } from "../domain/guild-ref.js";
import { rankId, type RosterMember } from "../domain/roster-member.js";
import type { GuildSnapshot } from "../domain/snapshot.js";
import { makeGetGuildRoster } from "./get-guild-roster.js";
import type { GuildCache, GuildSource } from "./ports.js";

const guild: GuildRef = { slug: "example-guild" };
const members: readonly RosterMember[] = [
  {
    characterId: "101",
    name: "Guildmaster",
    surname: "Example",
    level: 80,
    rankId: rankId(0),
    classId: "1",
    raceId: "1",
  },
];
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
  result: Awaited<ReturnType<GuildSource["fetchRoster"]>>,
): GuildSource {
  return {
    fetchProfile: () => Promise.resolve(err(appError("upstream.unavailable"))),
    fetchRoster: () => Promise.resolve(result),
  };
}

describe("get-guild-roster", () => {
  it("returns a fresh cache hit", async () => {
    const cache = new MemoryCache();
    cache.roster = { guild, fetchedAt: now, payload: members };
    const result = await makeGetGuildRoster({
      source: source(ok(members)),
      cache,
      clock: { now: () => now },
      maxAgeMs: 60_000,
    })(guild);
    expect(result.ok && result.value.stale).toBe(false);
    expect(result.ok && result.value.data).toEqual(members);
  });

  it("serves stale roster when upstream fails", async () => {
    const cache = new MemoryCache();
    cache.roster = { guild, fetchedAt: staleFetchedAt, payload: members };
    const result = await makeGetGuildRoster({
      source: source(err(appError("upstream.unavailable"))),
      cache,
      clock: { now: () => now },
      maxAgeMs: 60_000,
    })(guild);
    expect(result).toEqual({
      ok: true,
      value: { data: members, fetchedAt: staleFetchedAt, stale: true },
    });
  });

  it("returns upstream.unavailable when nothing is cached", async () => {
    const result = await makeGetGuildRoster({
      source: source(err(appError("upstream.unavailable"))),
      cache: new MemoryCache(),
      clock: { now: () => now },
      maxAgeMs: 60_000,
    })(guild);
    expect(result.ok).toBe(false);
  });
});
