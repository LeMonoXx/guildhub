import type { CharacterModel, CharacterModelBake } from "@guildhub/contracts";

export type PolledModel = Pick<CharacterModel, "status" | "bake"> | undefined;

/** A long queue on a small host can take this long; past it, a reload picks it up. */
const GIVE_UP_MS = 20 * 60_000;

const INTERVAL_BY_BAKE_STATE: Readonly<
  Record<CharacterModelBake["state"], number>
> = {
  opening: 2_000,
  baking: 2_000,
  queued: 5_000,
};

/** Backs off while the bake has not reported yet. */
const UNREPORTED_INTERVALS: readonly {
  readonly beforeMs: number;
  readonly intervalMs: number;
}[] = [
  { beforeMs: 2_000, intervalMs: 2_000 },
  { beforeMs: 6_000, intervalMs: 4_000 },
  { beforeMs: 14_000, intervalMs: 8_000 },
];
const UNREPORTED_LAST_INTERVAL = 15_000;

export function modelPollInterval(
  model: PolledModel,
  elapsedMs: number,
): number | false {
  if (model?.status !== "pending" || elapsedMs >= GIVE_UP_MS) return false;
  if (model.bake) return INTERVAL_BY_BAKE_STATE[model.bake.state];
  return (
    UNREPORTED_INTERVALS.find((step) => elapsedMs < step.beforeMs)
      ?.intervalMs ?? UNREPORTED_LAST_INTERVAL
  );
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
