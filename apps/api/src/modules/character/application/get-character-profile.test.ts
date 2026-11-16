import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import {
  emptyProfileData,
  type CharacterProfileSnapshot,
} from "../domain/profile.js";
import { makeGetCharacterProfile } from "./get-character-profile.js";
import { loadMemberProfiles } from "./load-member-profiles.js";
import type { CharacterProfileCache, CharacterProfileSource } from "./ports.js";

const now = new Date("2026-11-14T00:00:00.000Z");
const clock = { now: () => now };
const member: RosterMember = {
  characterId: "101",
  name: "Ann",
  surname: "Example",
  level: 20,
  rankId: rankId(0),
  classId: "1",
  raceId: "2",
  slug: "ann-example",
};

function memoryCache(initial: CharacterProfileSnapshot[] = []) {
  const saved: CharacterProfileSnapshot[] = [];
  const cache: CharacterProfileCache = {
    latestMany: (ids) =>
      Promise.resolve(initial.filter((s) => ids.includes(s.characterId))),
    save: (snapshot) => {
      saved.push(snapshot);
      return Promise.resolve();
    },
  };
  return { cache, saved };
}

const source = (
  result: Awaited<ReturnType<CharacterProfileSource["fetchProfile"]>>,
): CharacterProfileSource => ({ fetchProfile: () => Promise.resolve(result) });

describe("loadMemberProfiles", () => {
  it("serves a fresh cached profile without asking Battle.net", async () => {
    const cached: CharacterProfileSnapshot = {
      characterId: "101",
      slug: "ann-example",
      status: "available",
      data: emptyProfileData(20),
      fetchedAt: now,
    };
    const { cache } = memoryCache([cached]);
    const [loaded] = await loadMemberProfiles(
      {
        source: {
          fetchProfile: () => {
            throw new Error("must not fetch");
          },
        },
        cache,
        clock,
        maxAgeMs: 60_000,
      },
      [member],
      "en",
    );
    expect(loaded?.profile).toBe(cached);
  });

  it("stores a fetched profile as available", async () => {
    const { cache, saved } = memoryCache();
    const [loaded] = await loadMemberProfiles(
      {
        source: source(ok(emptyProfileData(21))),
        cache,
        clock,
        maxAgeMs: 60_000,
      },
      [member],
      "en",
    );
    expect(loaded?.profile.status).toBe("available");
    expect(saved).toHaveLength(1);
  });

  it("caches unpublished characters as unavailable", async () => {
    const { cache, saved } = memoryCache();
    const [loaded] = await loadMemberProfiles(
      {
        source: source(err(appError("character.not_found"))),
        cache,
        clock,
        maxAgeMs: 60_000,
      },
      [member],
      "en",
    );
    expect(loaded?.profile).toMatchObject({
      status: "unavailable",
      data: { summary: { level: 20 } },
    });
    expect(saved[0]?.status).toBe("unavailable");
  });

  it("keeps the previous profile when Battle.net is down", async () => {
    const previous: CharacterProfileSnapshot = {
      characterId: "101",
      slug: "ann-example",
      status: "available",
      data: emptyProfileData(19),
      fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const { cache, saved } = memoryCache([previous]);
    const [loaded] = await loadMemberProfiles(
      {
        source: source(err(appError("upstream.unavailable"))),
        cache,
        clock,
        maxAgeMs: 60_000,
      },
      [member],
      "en",
    );
    expect(loaded?.profile).toBe(previous);
    expect(saved).toHaveLength(0);
  });
});

describe("makeGetCharacterProfile", () => {
  it("returns character.not_found for an unknown slug", async () => {
    const { cache } = memoryCache();
    const result = await makeGetCharacterProfile({
      getRoster: () =>
        Promise.resolve(ok({ data: [member], fetchedAt: now, stale: false })),
      source: source(ok(emptyProfileData(20))),
      cache,
      clock,
      maxAgeMs: 60_000,
    })({ guild: { slug: "g" }, slug: "nobody", locale: "en" });
    expect(result).toEqual({
      ok: false,
      error: { code: "character.not_found" },
    });
  });

  it("forwards roster errors", async () => {
    const { cache } = memoryCache();
    const result = await makeGetCharacterProfile({
      getRoster: () => Promise.resolve(err(appError("upstream.unavailable"))),
      source: source(ok(emptyProfileData(20))),
      cache,
      clock,
      maxAgeMs: 60_000,
    })({ guild: { slug: "g" }, slug: "ann-example", locale: "en" });
    expect(result.ok).toBe(false);
  });
});
