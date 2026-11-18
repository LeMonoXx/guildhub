import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { RosterMember } from "../../guild/index.js";
import type { CharacterFacts, LookBakeDocument } from "../domain/look.js";
import type { CharacterSnapshot } from "../domain/snapshot.js";
import {
  makeBakeLook,
  makeEnsureBosses,
  makeEnsureFixedLook,
  makeEnsureWorldMap,
  makePrebakeBodies,
  makeRebakeLooks,
} from "./bake-models.js";
import type {
  BakeUpdate,
  ModelAssetStore,
  ModelBaker,
  PlayableRaceSource,
  PrebakeLedger,
  PrebakeRecord,
} from "./ports.js";

const look = { lookHash: "abc" } as LookBakeDocument;

function baker(overrides: Partial<ModelBaker> = {}): ModelBaker {
  return {
    bakeLook: () => Promise.resolve(),
    bakeFile: () => Promise.resolve(),
    bakeFixedLook: () => Promise.resolve(),
    bakeWorldMap: () => Promise.resolve(),
    bakeBosses: (ids) => Promise.resolve({ baked: ids.length, skipped: 0 }),
    currentBuild: () => Promise.resolve("2.0"),
    prebakeBody: () => Promise.resolve({ baked: true }),
    ...overrides,
  };
}

function races(ids: readonly number[]): PlayableRaceSource & { asked: number } {
  const source = {
    asked: 0,
    playableRaceIds: () => {
      source.asked++;
      return Promise.resolve(ok(ids));
    },
  };
  return source;
}

const unavailableRaces: PlayableRaceSource = {
  playableRaceIds: () => Promise.resolve(err(appError("upstream.unavailable"))),
};

function ledger(
  initial: PrebakeRecord = {},
): PrebakeLedger & { record: PrebakeRecord } {
  const store = {
    record: initial,
    read: () => Promise.resolve(store.record),
    write: (record: PrebakeRecord) => {
      store.record = record;
      return Promise.resolve();
    },
  };
  return store;
}

describe("bake models", () => {
  it("mirrors a look's progress and always closes it", async () => {
    const updates: BakeUpdate[] = [];
    let finished = 0;
    const bakeLook = makeBakeLook({
      baker: baker({
        bakeLook: (_look, onUpdate) => {
          onUpdate({ stage: "baking", fraction: 0.5 });
          return Promise.reject(new Error("crashed"));
        },
      }),
      progress: {
        track: () => ({
          update: (update) => updates.push(update),
          finish: () => {
            finished++;
            return Promise.resolve();
          },
        }),
      },
    });
    await expect(bakeLook(look)).rejects.toThrow("crashed");
    expect(updates).toEqual([{ stage: "baking", fraction: 0.5 }]);
    expect(finished).toBe(1);
  });

  it("bakes the fixed look only when it is missing", async () => {
    let bakes = 0;
    const counting = baker({
      bakeFixedLook: () => {
        bakes++;
        return Promise.resolve();
      },
    });
    const assets = (present: boolean) =>
      ({
        hasLook: () => Promise.resolve(present),
      }) as unknown as ModelAssetStore;
    expect(
      await makeEnsureFixedLook({ assets: assets(true), baker: counting })(),
    ).toBe("present");
    expect(
      await makeEnsureFixedLook({ assets: assets(false), baker: counting })(),
    ).toBe("baked");
    expect(bakes).toBe(1);
  });

  it("bakes the world map only when its atlas is missing", async () => {
    let bakes = 0;
    const counting = baker({
      bakeWorldMap: () => {
        bakes++;
        return Promise.resolve();
      },
    });
    const assets = (present: boolean) => ({
      hasWorldMap: () => Promise.resolve(present),
    });
    expect(
      await makeEnsureWorldMap({ assets: assets(true), baker: counting })(),
    ).toBe("present");
    expect(
      await makeEnsureWorldMap({ assets: assets(false), baker: counting })(),
    ).toBe("baked");
    expect(bakes).toBe(1);
  });

  it("asks the baker for every boss display", async () => {
    const asked: number[][] = [];
    const ensure = makeEnsureBosses({
      displayIds: [2837, 4088],
      baker: baker({
        bakeBosses: (ids) => {
          asked.push([...ids]);
          return Promise.resolve({ baked: 1, skipped: 1 });
        },
      }),
    });
    expect(await ensure()).toEqual({ baked: 1, skipped: 1 });
    expect(asked).toEqual([[2837, 4088]]);
  });

  it("prebakes both sexes of every race and keeps going past a failure", async () => {
    const asked: string[] = [];
    const record = ledger();
    const prebake = makePrebakeBodies({
      races: races([1, 2]),
      ledger: record,
      baker: baker({
        prebakeBody: (race, sex) => {
          asked.push(`${String(race)}-${String(sex)}`);
          if (race === 1 && sex === 1)
            return Promise.reject(new Error("no body"));
          return Promise.resolve({ baked: race === 2 });
        },
      }),
    });
    const summary = await prebake();
    expect(asked).toEqual(["1-0", "1-1", "2-0", "2-1"]);
    expect(summary).toEqual({
      ok: true,
      value: {
        build: "2.0",
        current: false,
        races: 2,
        baked: 2,
        failed: [{ race: 1, sex: 1, reason: "no body" }],
      },
    });
    expect(record.record).toEqual({ races: { build: "2.0", ids: [1, 2] } });
  });

  it("asks neither Battle.net nor the baker's bodies for a complete build", async () => {
    const source = races([1]);
    let bodies = 0;
    const prebake = makePrebakeBodies({
      races: source,
      ledger: ledger({
        races: { build: "2.0", ids: [1] },
        completeBuild: "2.0",
      }),
      baker: baker({
        prebakeBody: () => {
          bodies++;
          return Promise.resolve({ baked: false });
        },
      }),
    });
    const summary = await prebake();
    expect(summary.ok && summary.value.current).toBe(true);
    expect(source.asked).toBe(0);
    expect(bodies).toBe(0);
  });

  it("asks for the races again only when the build changes", async () => {
    const source = races([1, 3]);
    const record = ledger({
      races: { build: "1.0", ids: [1] },
      completeBuild: "1.0",
    });
    await makePrebakeBodies({
      races: source,
      ledger: record,
      baker: baker(),
    })();
    expect(source.asked).toBe(1);
    expect(record.record).toEqual({
      races: { build: "2.0", ids: [1, 3] },
      completeBuild: "2.0",
    });
  });

  it("reuses this build's stored races after an interrupted run", async () => {
    const source = races([9]);
    const asked: number[] = [];
    await makePrebakeBodies({
      races: source,
      ledger: ledger({ races: { build: "2.0", ids: [4] } }),
      baker: baker({
        prebakeBody: (race) => {
          asked.push(race);
          return Promise.resolve({ baked: true });
        },
      }),
    })();
    expect(source.asked).toBe(0);
    expect(asked).toEqual([4, 4]);
  });

  it("does not count a stopped run as complete", async () => {
    let calls = 0;
    const record = ledger();
    await makePrebakeBodies({
      races: races([1, 2, 3]),
      ledger: record,
      baker: baker({
        prebakeBody: () => {
          calls++;
          return Promise.resolve({ baked: true });
        },
      }),
    })(() => calls >= 2);
    expect(calls).toBe(2);
    expect(record.record.completeBuild).toBeUndefined();
  });

  it("falls back to the last known races while Battle.net is down", async () => {
    const asked: number[] = [];
    const record = ledger({ races: { build: "1.0", ids: [5] } });
    const summary = await makePrebakeBodies({
      races: unavailableRaces,
      ledger: record,
      baker: baker({
        prebakeBody: (race) => {
          asked.push(race);
          return Promise.resolve({ baked: true });
        },
      }),
    })();
    expect(summary.ok).toBe(true);
    expect(asked).toEqual([5, 5]);
    expect(record.record.completeBuild).toBeUndefined();
  });

  it("reports when no race list is known at all", async () => {
    const prebake = makePrebakeBodies({
      baker: baker(),
      races: unavailableRaces,
      ledger: ledger(),
    });
    expect(await prebake()).toEqual({
      ok: false,
      error: { code: "upstream.unavailable" },
    });
  });
});

function facts(raceId: number): CharacterFacts {
  return {
    raceId,
    sex: 0,
    classId: 1,
    customizations: [],
    itemIds: [],
    equipmentOverrides: [],
  };
}

function snapshot(
  characterId: string,
  status: CharacterSnapshot["status"],
  raceId = 1,
): CharacterSnapshot {
  return {
    characterId,
    slug: characterId,
    name: characterId,
    surname: "",
    status,
    facts: facts(raceId),
    fetchedAt: new Date(0),
  };
}

function rebake(options: {
  published: string;
  snapshots: readonly CharacterSnapshot[];
  present?: (hash: string) => boolean;
  fail?: (hash: string) => boolean;
  stopAfter?: number;
}) {
  const state = {
    published: options.published,
    requested: [] as string[],
    baked: [] as LookBakeDocument[],
  };
  const assets = {
    currentBuild: () => Promise.resolve(state.published),
    publishBuild: (build: string) => {
      state.published = build;
      return Promise.resolve();
    },
    hasLook: (hash: string) =>
      Promise.resolve(options.present?.(hash) ?? false),
    writeLookRequest: (job: LookBakeDocument) => {
      state.requested.push(job.lookHash);
      return Promise.resolve();
    },
    bakeProgress: () => Promise.resolve(undefined),
  } satisfies ModelAssetStore;
  const run = makeRebakeLooks({
    baker: baker(),
    assets,
    bakeLook: (job) => {
      if (options.fail?.(job.lookHash) === true)
        return Promise.reject(new Error("no body"));
      state.baked.push(job);
      return Promise.resolve();
    },
    roster: () =>
      Promise.resolve(
        options.snapshots.map(
          (s) => ({ characterId: s.characterId }) as RosterMember,
        ),
      ),
    cache: {
      latest: () => Promise.resolve(undefined),
      latestMany: (ids) =>
        Promise.resolve(
          options.snapshots.filter((s) => ids.includes(s.characterId)),
        ),
      save: () => Promise.resolve(),
    },
  });
  let checks = 0;
  return {
    state,
    run: () =>
      run(
        () => options.stopAfter !== undefined && checks++ >= options.stopAfter,
      ),
  };
}

describe("rebake looks for a new build", () => {
  it("does nothing while the site shows the build the baker serves", async () => {
    const { state, run } = rebake({
      published: "2.0",
      snapshots: [snapshot("a", "found")],
    });
    expect(await run()).toMatchObject({ current: true, published: false });
    expect(state.baked).toEqual([]);
  });

  it("bakes each published member's look once for the new build, then goes live", async () => {
    const { state, run } = rebake({
      published: "1.0",
      snapshots: [
        snapshot("a", "found", 1),
        snapshot("twin", "found", 1),
        snapshot("b", "found", 2),
        snapshot("hidden", "missing", 3),
      ],
    });
    const summary = await run();
    expect(summary).toMatchObject({
      build: "2.0",
      looks: 2,
      baked: 2,
      published: true,
    });
    expect(state.baked.map((look) => look.clientBuild)).toEqual(["2.0", "2.0"]);
    expect(state.requested).toHaveLength(2);
    expect(state.published).toBe("2.0");
  });

  it("goes live past a failed look and skips looks already baked", async () => {
    const first = rebake({
      published: "1.0",
      snapshots: [snapshot("a", "found", 1)],
    });
    await first.run();
    const present = first.state.baked[0]?.lookHash;
    const { state, run } = rebake({
      published: "1.0",
      snapshots: [snapshot("a", "found", 1), snapshot("b", "found", 2)],
      present: (hash) => hash === present,
      fail: () => true,
    });
    const summary = await run();
    expect(summary).toMatchObject({ baked: 0, published: true });
    expect(summary.failed).toHaveLength(1);
    expect(state.published).toBe("2.0");
  });

  it("stays on the old build when the worker stops mid-way", async () => {
    const { state, run } = rebake({
      published: "1.0",
      snapshots: [snapshot("a", "found", 1), snapshot("b", "found", 2)],
      stopAfter: 1,
    });
    expect(await run()).toMatchObject({ baked: 1, published: false });
    expect(state.published).toBe("1.0");
  });
});
