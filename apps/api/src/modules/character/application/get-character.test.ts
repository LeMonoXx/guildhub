import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import type { CharacterFacts } from "../domain/look.js";
import type { BakeProgress } from "../domain/model.js";
import { makeGetCharacter } from "./get-character.js";
import type {
  CharacterCache,
  CharacterSource,
  ModelAssetStore,
  ModelBuildQueue,
} from "./ports.js";

const guild = { slug: "example-guild" };
const now = new Date("2026-11-13T12:00:00.000Z");
const member: RosterMember = {
  characterId: "101",
  name: "Guildmaster",
  surname: "Example",
  level: 80,
  rankId: rankId(0),
  classId: "1",
  raceId: "1",
  slug: "guildmaster-example",
};

const facts: CharacterFacts = {
  raceId: 1,
  sex: 0,
  classId: 1,
  customizations: [{ optionId: 58, choiceId: 915 }],
  itemIds: [16820, 19019],
  equipmentOverrides: [{ itemId: 19019, equipSlot: 16 }],
  renderAssetUrl: "https://render.worldofwarcraft.com/example.png",
};

function source(
  result: Awaited<ReturnType<CharacterSource["fetchFacts"]>> = ok(facts),
): CharacterSource {
  return { fetchFacts: () => Promise.resolve(result) };
}

function cache(
  latest?: Awaited<ReturnType<CharacterCache["latest"]>>,
): CharacterCache {
  const saved: unknown[] = [];
  return {
    latest: () => Promise.resolve(latest),
    latestMany: () => Promise.resolve(latest === undefined ? [] : [latest]),
    save: (snapshot) => {
      saved.push(snapshot);
      return Promise.resolve();
    },
  };
}

function assets(
  readyHashes: readonly string[] = [],
  progress?: BakeProgress,
): ModelAssetStore {
  const requests: string[] = [];
  return {
    currentBuild: () => Promise.resolve("1.60.1.70938"),
    publishBuild: () => Promise.resolve(),
    hasLook: (hash) => Promise.resolve(readyHashes.includes(hash)),
    writeLookRequest: (job) => {
      requests.push(job.lookHash);
      return Promise.resolve();
    },
    bakeProgress: () => Promise.resolve(progress),
  };
}

function queue(): ModelBuildQueue & { looks: string[]; converts: string[] } {
  const looks: string[] = [];
  const converts: string[] = [];
  return {
    looks,
    converts,
    enqueueLook: (job) => {
      looks.push(job.lookHash);
      return Promise.resolve();
    },
    enqueueConvert: (job) => {
      converts.push(`${job.build}:${String(job.fileId)}`);
      return Promise.resolve();
    },
    queuedLooks: () => Promise.resolve(looks),
  };
}

function getCharacter(overrides?: {
  source?: CharacterSource;
  cache?: CharacterCache;
  assets?: ModelAssetStore;
  queue?: ModelBuildQueue;
  roster?: RosterMember[];
}) {
  return makeGetCharacter({
    getRoster: () =>
      Promise.resolve(
        ok({
          data: overrides?.roster ?? [member],
          fetchedAt: now,
          stale: false,
        }),
      ),
    source: overrides?.source ?? source(),
    cache: overrides?.cache ?? cache(),
    assets: overrides?.assets ?? assets(),
    queue: overrides?.queue ?? queue(),
    clock: { now: () => now },
    maxAgeMs: 900_000,
    fallbackBuild: "wowf",
  });
}

describe("get-character", () => {
  it("returns a pending model and enqueues the look once", async () => {
    const jobs = queue();
    const result = await getCharacter({ queue: jobs })({
      guild,
      slug: "guildmaster-example",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.member.slug).toBe("guildmaster-example");
    expect(result.value.data.model.status).toBe("pending");
    expect(result.value.data.model.renderUrl).toBe(
      "/api/characters/guildmaster-example/render",
    );
    expect(result.value.data.lookManifest).toBe(
      "/assets/looks/fixed/look.json",
    );
    expect(jobs.looks).toHaveLength(1);
    expect(jobs.looks[0]).toBe(result.value.data.model.lookHash);
  });

  it("returns a ready model without enqueueing when the bake exists", async () => {
    const jobs = queue();
    const store = assets();
    const pending = await getCharacter({ queue: jobs, assets: store })({
      guild,
      slug: "guildmaster-example",
    });
    expect(pending.ok).toBe(true);
    if (!pending.ok) return;
    const hash = pending.value.data.model.lookHash;
    const result = await getCharacter({
      queue: queue(),
      assets: assets([hash]),
    })({ guild, slug: "guildmaster-example" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.model.status).toBe("ready");
    expect(result.value.data.lookManifest).toBe(
      `/assets/looks/${hash}/look.json`,
    );
  });

  it("reports how far a running bake is", async () => {
    const result = await getCharacter({
      assets: assets([], { stage: "baking", fraction: 0.42, updatedAt: now }),
    })({ guild, slug: "guildmaster-example" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.data.model.bake).toEqual({
      state: "baking",
      fraction: 0.42,
    });
  });

  it("returns character.not_found when the slug is missing", async () => {
    const result = await getCharacter()({ guild, slug: "missing" });
    expect(result).toEqual({
      ok: false,
      error: { code: "character.not_found" },
    });
  });

  it("forwards roster errors", async () => {
    const result = await makeGetCharacter({
      getRoster: () => Promise.resolve(err(appError("guild.not_found"))),
      source: source(),
      cache: cache(),
      assets: assets(),
      queue: queue(),
      clock: { now: () => now },
      maxAgeMs: 900_000,
      fallbackBuild: "wowf",
    })({ guild, slug: "guildmaster-example" });
    expect(result.ok).toBe(false);
  });
});
