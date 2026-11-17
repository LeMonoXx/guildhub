import type { AppError } from "../../../platform/kernel/app-error.js";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type { LookBakeDocument } from "../domain/look.js";
import type {
  BakeProgressSink,
  ModelAssetStore,
  ModelBaker,
  PlayableRaceSource,
  PrebakeLedger,
  PrebakeRecord,
  WorldMapAssets,
} from "./ports.js";

/** Every body comes in both sexes the game knows. */
const SEXES = [0, 1] as const;
const FIXED_LOOK = "fixed";

export type BakeLook = (look: LookBakeDocument) => Promise<void>;

export const makeBakeLook =
  (deps: {
    readonly baker: ModelBaker;
    readonly progress: BakeProgressSink;
  }): BakeLook =>
  async (look) => {
    const tracked = deps.progress.track(look.lookHash);
    try {
      await deps.baker.bakeLook(look, (update) => {
        tracked.update(update);
      });
    } finally {
      await tracked.finish();
    }
  };

/** Characters without a baked look of their own stand in the fixed look. */
export const makeEnsureFixedLook =
  (deps: { readonly assets: ModelAssetStore; readonly baker: ModelBaker }) =>
  async (): Promise<"present" | "baked"> => {
    if (await deps.assets.hasLook(FIXED_LOOK)) return "present";
    await deps.baker.bakeFixedLook();
    return "baked";
  };

/** The party map shows the in-game world map; it is baked once per asset volume. */
export const makeEnsureWorldMap =
  (deps: { readonly assets: WorldMapAssets; readonly baker: ModelBaker }) =>
  async (): Promise<"present" | "baked"> => {
    if (await deps.assets.hasWorldMap()) return "present";
    await deps.baker.bakeWorldMap();
    return "baked";
  };

/** Every dungeon's last boss is baked ahead, so the party map never waits for one. */
export const makeEnsureBosses =
  (deps: {
    readonly baker: ModelBaker;
    readonly displayIds: readonly number[];
  }) =>
  () =>
    deps.baker.bakeBosses(deps.displayIds);

export interface PrebakeSummary {
  readonly build: string;
  /** True when this build was already complete; nothing was asked or baked. */
  readonly current: boolean;
  readonly races: number;
  readonly baked: number;
  readonly failed: readonly {
    readonly race: number;
    readonly sex: number;
    readonly reason: string;
  }[];
}

/**
 * Bakes every playable body with all its appearance textures once per game
 * build, so a member's first look only adds gear. The race list is asked for
 * only when the build changes. A failed body does not stop the others, and a
 * build counts as complete only when every body is baked, so the next run
 * tries the rest.
 */
export const makePrebakeBodies =
  (deps: {
    readonly baker: ModelBaker;
    readonly races: PlayableRaceSource;
    readonly ledger: PrebakeLedger;
  }) =>
  async (
    shouldStop: () => boolean = () => false,
  ): Promise<Result<PrebakeSummary, AppError<"upstream.unavailable">>> => {
    const build = await deps.baker.currentBuild();
    const record = await deps.ledger.read();
    if (record.completeBuild === build)
      return ok({
        build,
        current: true,
        races: record.races?.ids.length ?? 0,
        baked: 0,
        failed: [],
      });

    const races = await raceListFor(build, record, deps);
    if (!races.ok) return races;
    const run = await bakeBodies(deps.baker, races.value.ids, shouldStop);
    if (races.value.fresh && !run.stopped && run.failed.length === 0)
      await deps.ledger.write({
        ...(await deps.ledger.read()),
        completeBuild: build,
      });
    return ok({
      build,
      current: false,
      races: races.value.ids.length,
      baked: run.baked,
      failed: run.failed,
    });
  };

interface RaceList {
  readonly ids: readonly number[];
  /** False when Battle.net was down and an older build's list stood in. */
  readonly fresh: boolean;
}

async function raceListFor(
  build: string,
  record: PrebakeRecord,
  deps: { readonly races: PlayableRaceSource; readonly ledger: PrebakeLedger },
): Promise<Result<RaceList, AppError<"upstream.unavailable">>> {
  if (record.races?.build === build)
    return ok({ ids: record.races.ids, fresh: true });
  const fetched = await deps.races.playableRaceIds();
  if (fetched.ok) {
    await deps.ledger.write({
      ...record,
      races: { build, ids: fetched.value },
    });
    return ok({ ids: fetched.value, fresh: true });
  }
  if (record.races === undefined) return fetched;
  return ok({ ids: record.races.ids, fresh: false });
}

interface BodyRun {
  readonly baked: number;
  readonly failed: PrebakeSummary["failed"];
  readonly stopped: boolean;
}

async function bakeBodies(
  baker: ModelBaker,
  raceIds: readonly number[],
  shouldStop: () => boolean,
): Promise<BodyRun> {
  let baked = 0;
  const failed: PrebakeSummary["failed"][number][] = [];
  for (const race of raceIds) {
    for (const sex of SEXES) {
      if (shouldStop()) return { baked, failed, stopped: true };
      try {
        if ((await baker.prebakeBody(race, sex)).baked) baked++;
      } catch (error) {
        failed.push({
          race,
          sex,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  return { baked, failed, stopped: false };
}
