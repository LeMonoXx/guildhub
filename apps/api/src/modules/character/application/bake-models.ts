import type { AppError } from "../../../platform/kernel/app-error.js";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type { LookBakeDocument } from "../domain/look.js";
import type {
  BakeProgressSink,
  ModelAssetStore,
  ModelBaker,
  PlayableRaceSource,
  PrebakeLedger,
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

    let raceIds = record.races?.build === build ? record.races.ids : undefined;
    let listFresh = raceIds !== undefined;
    if (raceIds === undefined) {
      const fetched = await deps.races.playableRaceIds();
      if (fetched.ok) {
        raceIds = fetched.value;
        listFresh = true;
        await deps.ledger.write({
          ...record,
          races: { build, ids: fetched.value },
        });
      } else if (record.races !== undefined) {
        raceIds = record.races.ids;
      } else {
        return fetched;
      }
    }

    let baked = 0;
    let stopped = false;
    const failed: PrebakeSummary["failed"][number][] = [];
    bodies: for (const race of raceIds) {
      for (const sex of SEXES) {
        if (shouldStop()) {
          stopped = true;
          break bodies;
        }
        try {
          if ((await deps.baker.prebakeBody(race, sex)).baked) baked++;
        } catch (error) {
          failed.push({
            race,
            sex,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (listFresh && !stopped && failed.length === 0)
      await deps.ledger.write({
        ...(await deps.ledger.read()),
        completeBuild: build,
      });
    return ok({ build, current: false, races: raceIds.length, baked, failed });
  };
