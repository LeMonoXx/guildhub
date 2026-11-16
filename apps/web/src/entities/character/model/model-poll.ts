import type { CharacterModel } from "@guildhub/contracts";

type PolledModel = Pick<CharacterModel, "status" | "bake"> | undefined;

/** A long queue on a small host can take this long; past it, a reload picks it up. */
const GIVE_UP_MS = 20 * 60_000;

export function modelPollInterval(
  model: PolledModel,
  elapsedMs: number,
): number | false {
  if (model?.status !== "pending") return false;
  if (elapsedMs >= GIVE_UP_MS) return false;
  if (model.bake?.state === "baking" || model.bake?.state === "opening")
    return 2_000;
  if (model.bake?.state === "queued") return 5_000;
  if (elapsedMs < 2_000) return 2_000;
  if (elapsedMs < 6_000) return 4_000;
  if (elapsedMs < 14_000) return 8_000;
  return 15_000;
}

/** The soonest any of several models wants to be asked again. */
export function modelsPollInterval(
  models: readonly PolledModel[],
  elapsedMs: number,
): number | false {
  const intervals = models
    .map((model) => modelPollInterval(model, elapsedMs))
    .filter((interval): interval is number => interval !== false);
  return intervals.length > 0 ? Math.min(...intervals) : false;
}
