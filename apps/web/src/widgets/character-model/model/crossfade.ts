// Deterministic multi-clip sequencing is adapted from Altrobe commit
// b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import { loopTime, type ClipAction } from "./clip-timing";

export interface Crossfade {
  readonly from: ClipAction;
  readonly to: ClipAction;
  readonly fromTime: number;
  elapsed: number;
  readonly duration: number;
}

function holdPaused(clip: ClipAction, weight: number): void {
  clip.action.reset().play();
  clip.action.paused = true;
  clip.action.setEffectiveWeight(weight);
}

/** Both clips must already be stopped; `from` resumes where it was. */
export function startCrossfade(
  from: ClipAction,
  to: ClipAction,
  fromTime: number,
  duration: number,
): Crossfade {
  holdPaused(from, 1);
  from.action.time = fromTime;
  holdPaused(to, 0);
  return { from, to, fromTime, elapsed: 0, duration };
}

/** Poses both clips for the current fade time; true once `to` has taken over. */
export function applyCrossfade(fade: Crossfade): boolean {
  const factor = Math.min(fade.elapsed / fade.duration, 1);
  fade.from.action.time = loopTime(
    fade.fromTime + fade.elapsed,
    fade.from.clip,
  );
  fade.to.action.time = loopTime(fade.elapsed, fade.to.clip);
  fade.from.action.setEffectiveWeight(1 - factor);
  fade.to.action.setEffectiveWeight(factor);
  if (factor < 1) return false;
  fade.from.action.stop();
  fade.to.action.setEffectiveWeight(1);
  return true;
}

export function cancelCrossfade(fade: Crossfade): void {
  fade.from.action.stop();
  fade.to.action.stop();
}
