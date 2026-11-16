// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import type * as THREE from "three";
import type { LoadedModel } from "../lib/asset-store";
import type { AnimationGroup } from "./animation-controller";
import type { ModelAnimationPlan } from "./model-runtime";

export interface AnimationOptions {
  groups?: readonly AnimationGroup[];
  defaultGroupId?: number;
  timeScale?: number;
}

const clipSeconds = (durationMs: number) => Math.max(durationMs, 1) / 1000;

/** Stand (id 0) plays as the primary loop; global sequences run beside it. */
export function animationPlan(
  model: LoadedModel,
  options: AnimationOptions = {},
): ModelAnimationPlan {
  const byName = new Map(model.animations.map((clip) => [clip.name, clip]));
  for (const metadata of model.metadata.animations ?? []) {
    const clip = metadata.name ? byName.get(metadata.name) : undefined;
    if (clip) clip.duration = clipSeconds(metadata.durationMs);
  }
  const ordered = [...(model.metadata.animations ?? [])].sort(
    (left, right) =>
      (left.variation ?? 0) - (right.variation ?? 0) ||
      (left.name ?? "").localeCompare(right.name ?? ""),
  );
  const select = (
    predicate: (animation: (typeof ordered)[number]) => boolean,
  ) =>
    ordered
      .filter(predicate)
      .map((metadata) =>
        metadata.name ? byName.get(metadata.name) : undefined,
      )
      .filter((clip): clip is THREE.AnimationClip => clip !== undefined);
  return {
    primary: select(
      (metadata) => metadata.globalSequence === undefined && metadata.id === 0,
    ),
    concurrent: select((metadata) => metadata.globalSequence !== undefined),
    groups: options.groups,
    defaultGroupId: options.defaultGroupId,
    timeScale: options.timeScale,
  };
}
