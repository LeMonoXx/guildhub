// Billboard and per-model animation lifecycle semantics are adapted from
// Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import {
  AnimationController,
  type AnimationGroup,
} from "./animation-controller";
import {
  captureBillboard,
  faceCamera,
  restoreBillboard,
  type BillboardBone,
} from "./billboard";
import type { TimelineParticipant } from "./lifecycle";
import type { MaterialAnimationController } from "./material-animation";
import type { ParticleMesh } from "./particle-mesh";

export interface ModelAnimationPlan {
  primary: readonly THREE.AnimationClip[];
  concurrent: readonly THREE.AnimationClip[];
  groups?: readonly AnimationGroup[];
  defaultGroupId?: number;
  timeScale?: number;
}

export class ModelRuntime implements TimelineParticipant {
  readonly animation: AnimationController;
  private disposed = false;

  constructor(
    readonly root: THREE.Object3D,
    plan: ModelAnimationPlan,
    private readonly particles: readonly ParticleMesh[],
    private readonly billboards: readonly BillboardBone[],
    private readonly materials: MaterialAnimationController,
  ) {
    this.animation = new AnimationController(
      root,
      plan.primary,
      plan.concurrent,
      {
        groups: plan.groups,
        defaultGroupId: plan.defaultGroupId,
        timeScale: plan.timeScale,
      },
    );
  }

  update(delta: number): void {
    if (this.disposed) return;
    for (const billboard of this.billboards) restoreBillboard(billboard);
    this.animation.update(delta);
    this.materials.update(delta);
    for (const billboard of this.billboards) captureBillboard(billboard);
    for (const particle of this.particles) particle.update(delta);
  }

  setTime(time: number): void {
    if (this.disposed) return;
    for (const billboard of this.billboards) restoreBillboard(billboard);
    this.animation.setTime(time);
    this.materials.setTime(time);
    for (const billboard of this.billboards) captureBillboard(billboard);
    for (const particle of this.particles) particle.setTime(time);
    this.root.updateMatrixWorld(true);
  }

  reset(): void {
    if (this.disposed) return;
    for (const billboard of this.billboards) restoreBillboard(billboard);
    this.animation.reset();
    this.materials.reset();
    for (const billboard of this.billboards) captureBillboard(billboard);
    for (const particle of this.particles) particle.reset();
  }

  faceCamera(camera: THREE.Camera): void {
    if (this.disposed) return;
    for (const billboard of this.billboards) faceCamera(billboard, camera);
  }

  selectMaterialSequence(sequenceId: number): void {
    this.materials.selectSequence(sequenceId);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.animation.dispose();
    this.materials.dispose();
    for (const particle of this.particles) particle.dispose();
  }
}

export class CharacterRuntime implements TimelineParticipant {
  private readonly models: ModelRuntime[] = [];
  private disposed = false;

  add(runtime: ModelRuntime): ModelRuntime {
    if (this.disposed) {
      runtime.dispose();
      throw new Error("Cannot add a model to a disposed character runtime");
    }
    this.models.push(runtime);
    return runtime;
  }

  get primary(): AnimationController | undefined {
    return this.models[0]?.animation;
  }

  selectPrimaryGroup(group: string | number, fadeDuration = 0): boolean {
    const primary = this.models[0];
    if (!primary?.animation.selectGroup(group, fadeDuration)) return false;
    // Material selection changes at the target group's time-zero boundary,
    // even while the skeletal poses continue their deterministic crossfade.
    primary.selectMaterialSequence(
      primary.animation.selectedGroupDescriptor?.id ?? 0,
    );
    return true;
  }

  update(delta: number): void {
    if (!this.disposed)
      for (const model of this.models) model.update(Math.max(delta, 0));
  }

  setTime(time: number): void {
    if (!this.disposed)
      for (const model of this.models) model.setTime(Math.max(time, 0));
  }

  reset(): void {
    if (!this.disposed) for (const model of this.models) model.reset();
  }

  faceCamera(camera: THREE.Camera): void {
    if (!this.disposed)
      for (const model of this.models) model.faceCamera(camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const model of [...this.models].reverse()) model.dispose();
    this.models.length = 0;
  }
}
