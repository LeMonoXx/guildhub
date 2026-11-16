import { describe, expect, it } from "vitest";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { LookBakeDocument } from "../domain/look.js";
import {
  makeBakeLook,
  makeEnsureFixedLook,
  makePrebakeBodies,
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
