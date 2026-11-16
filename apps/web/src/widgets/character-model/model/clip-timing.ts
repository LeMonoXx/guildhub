import type * as THREE from "three";

export interface ClipAction {
  name: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
}

export const MIN_CLIP_SECONDS = 0.001;

/** `time` wrapped into one loop of `clip`. */
export const loopTime = (time: number, clip: THREE.AnimationClip): number =>
  time % Math.max(clip.duration, MIN_CLIP_SECONDS);

/** Where `time` falls when the clips play back to back, looping as a whole. */
export function sequencePosition(
  clips: readonly ClipAction[],
  time: number,
): { index: number; local: number } {
  if (!clips.length) return { index: -1, local: 0 };
  const durations = clips.map(({ clip }) =>
    Math.max(clip.duration, MIN_CLIP_SECONDS),
  );
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  let local = ((time % total) + total) % total;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = durations[index] ?? MIN_CLIP_SECONDS;
    if (local < duration || index === durations.length - 1)
      return { index, local };
    local -= duration;
  }
  return { index: 0, local: 0 };
}
