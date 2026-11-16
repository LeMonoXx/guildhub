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
} from "./ports.js";

const look = { lookHash: "abc" } as LookBakeDocument;

function baker(overrides: Partial<ModelBaker> = {}): ModelBaker {
  return {
    bakeLook: () => Promise.resolve(),
    bakeFile: () => Promise.resolve(),
    bakeFixedLook: () => Promise.resolve(),
    prebakeBody: () => Promise.resolve({ baked: true }),
    ...overrides,
  };
}

const races = (ids: readonly number[]): PlayableRaceSource => ({
  playableRaceIds: () => Promise.resolve(ok(ids)),
});

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
    const prebake = makePrebakeBodies({
      races: races([1, 2]),
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
        races: 2,
        baked: 2,
        failed: [{ race: 1, sex: 1, reason: "no body" }],
      },
    });
  });

  it("stops between bodies when asked to", async () => {
    let calls = 0;
    const prebake = makePrebakeBodies({
      races: races([1, 2, 3]),
      baker: baker({
        prebakeBody: () => {
          calls++;
          return Promise.resolve({ baked: true });
        },
      }),
    });
    await prebake(() => calls >= 2);
    expect(calls).toBe(2);
  });

  it("reports when the race list is unavailable", async () => {
    const prebake = makePrebakeBodies({
      baker: baker(),
      races: {
        playableRaceIds: () =>
          Promise.resolve(err(appError("upstream.unavailable"))),
      },
    });
    expect(await prebake()).toEqual({
      ok: false,
      error: { code: "upstream.unavailable" },
    });
  });
});
