import type { AppError } from "../../../platform/kernel/app-error.js";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type { LookBakeDocument } from "../domain/look.js";
import type {
  BakeProgressSink,
  ModelAssetStore,
  ModelBaker,
  PlayableRaceSource,
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
 * build, so a member's first look only adds gear. A failed body does not stop
 * the others; the next run tries it again.
 */
export const makePrebakeBodies =
  (deps: { readonly baker: ModelBaker; readonly races: PlayableRaceSource }) =>
  async (
    shouldStop: () => boolean = () => false,
  ): Promise<Result<PrebakeSummary, AppError<"upstream.unavailable">>> => {
    const races = await deps.races.playableRaceIds();
    if (!races.ok) return races;
    let baked = 0;
    const failed: PrebakeSummary["failed"][number][] = [];
    bodies: for (const race of races.value) {
      for (const sex of SEXES) {
        if (shouldStop()) break bodies;
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
    return ok({ races: races.value.length, baked, failed });
  };
