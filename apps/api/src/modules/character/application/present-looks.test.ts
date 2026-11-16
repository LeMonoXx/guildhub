import { describe, expect, it } from "vitest";
import { ok } from "../../../platform/kernel/result.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import type { CharacterFacts } from "../domain/look.js";
import type { CharacterSnapshot } from "../domain/snapshot.js";
import {
  makePresentFeaturedMembers,
  makePresentRosterMembers,
} from "./present-looks.js";
import type {
  CharacterCache,
  CharacterSource,
  ModelAssetStore,
  ModelBuildQueue,
} from "./ports.js";

const member: RosterMember = {
  characterId: "101",
  name: "Ann",
  surname: "Example",
  level: 80,
  rankId: rankId(0),
  classId: "4",
  raceId: "1",
  slug: "ann-example",
};

const facts: CharacterFacts = {
  raceId: 1,
  sex: 0,
  classId: 4,
  customizations: [],
  itemIds: [16820],
  equipmentOverrides: [],
  renderAssetUrl: "https://render.worldofwarcraft.com/ann.png",
};

describe("present featured members", () => {
  it("enqueues featured looks and falls back to the fixed manifest until ready", async () => {
    const looks: string[] = [];
    const source: CharacterSource = {
      fetchFacts: () => Promise.resolve(ok(facts)),
    };
    const cache: CharacterCache = {
      latest: () => Promise.resolve(undefined),
      latestMany: () => Promise.resolve([]),
      save: () => Promise.resolve(),
    };
    const assets: ModelAssetStore = {
      currentBuild: () => Promise.resolve("1.60.1.70938"),
      hasLook: () => Promise.resolve(false),
      writeLookRequest: () => Promise.resolve(),
      bakeProgress: () => Promise.resolve(undefined),
    };
    const queue: ModelBuildQueue = {
      enqueueLook: (job) => {
        looks.push(job.lookHash);
        return Promise.resolve();
      },
      enqueueConvert: () => Promise.resolve(),
      queuedLooks: () => Promise.resolve(looks),
    };
    const presented = await makePresentFeaturedMembers({
      source,
      cache,
      assets,
      queue,
      clock: { now: () => new Date("2026-11-13T12:00:00.000Z") },
      maxAgeMs: 900_000,
      fallbackBuild: "wowf",
    })([member]);
    expect(presented[0]?.lookManifest).toBe("/assets/looks/fixed/look.json");
    expect(presented[0]?.renderUrl).toBe("/api/characters/ann-example/render");
    expect(looks).toHaveLength(1);
    expect(presented[0]?.model).toMatchObject({
      status: "pending",
      bake: { state: "queued", position: 1 },
    });
  });

  it("points featured members at their baked look when it exists", async () => {
    const presented = await makePresentFeaturedMembers({
      source: { fetchFacts: () => Promise.resolve(ok(facts)) },
      cache: {
        latest: () => Promise.resolve(undefined),
        latestMany: () => Promise.resolve([]),
        save: () => Promise.resolve(),
      },
      assets: {
        currentBuild: () => Promise.resolve("1.60.1.70938"),
        hasLook: () => Promise.resolve(true),
        writeLookRequest: () => Promise.resolve(),
        bakeProgress: () => Promise.resolve(undefined),
      },
      queue: {
        enqueueLook: () => Promise.resolve(),
        enqueueConvert: () => Promise.resolve(),
        queuedLooks: () => Promise.resolve([]),
      },
      clock: { now: () => new Date("2026-11-13T12:00:00.000Z") },
      maxAgeMs: 900_000,
      fallbackBuild: "wowf",
    })([member]);
    expect(presented[0]?.lookManifest).toMatch(
      /^\/assets\/looks\/[0-9a-f]{16}\/look\.json$/,
    );
    expect(presented[0]?.lookManifest).not.toBe(
      "/assets/looks/fixed/look.json",
    );
  });
});

describe("present roster members", () => {
  const snapshot = (overrides: Partial<CharacterFacts>): CharacterSnapshot => ({
    characterId: member.characterId,
    slug: member.slug,
    name: member.name,
    surname: member.surname,
    status: "found",
    facts: { ...facts, ...overrides },
    fetchedAt: new Date("2026-11-13T12:00:00.000Z"),
  });
  const present = (snapshots: CharacterSnapshot[]) =>
    makePresentRosterMembers({
      cache: {
        latest: () => Promise.resolve(undefined),
        latestMany: () => Promise.resolve(snapshots),
        save: () => Promise.resolve(),
      },
    })([member]);

  it("links the render and avatar proxies only for media Battle.net published", async () => {
    const [withAvatar] = await present([
      snapshot({ avatarAssetUrl: "https://render.worldofwarcraft.com/a.jpg" }),
    ]);
    expect(withAvatar).toMatchObject({
      renderUrl: "/api/characters/ann-example/render",
      avatarUrl: "/api/characters/ann-example/avatar",
    });

    const [withoutMedia] = await present([]);
    expect(withoutMedia).not.toHaveProperty("renderUrl");
    expect(withoutMedia).not.toHaveProperty("avatarUrl");
  });
});
