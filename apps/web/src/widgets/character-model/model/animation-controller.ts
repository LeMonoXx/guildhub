// Deterministic multi-clip sequencing is adapted from Altrobe commit
// b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import { AnimationLayers, type AnimationMask } from "./animation-layers";
import { loopTime, sequencePosition, type ClipAction } from "./clip-timing";
import {
  applyCrossfade,
  cancelCrossfade,
  startCrossfade,
  type Crossfade,
} from "./crossfade";
import type { TimelineParticipant } from "./lifecycle";

export type { AnimationMask } from "./animation-layers";

const clipKey = (clip: THREE.AnimationClip, index: number) =>
  clip.name || `clip-${String(index)}`;

export interface AnimationGroup {
  id?: number;
  name: string;
  clips: readonly THREE.AnimationClip[];
}

export interface AnimationControllerOptions {
  groups?: readonly AnimationGroup[];
  defaultGroupId?: number;
  timeScale?: number;
}

interface GroupActions {
  id?: number;
  name: string;
  clips: ClipAction[];
}

const matchesGroup = (candidate: GroupActions, group: string | number) =>
  typeof group === "number" ? candidate.id === group : candidate.name === group;

export class AnimationController implements TimelineParticipant {
  private readonly mixer: THREE.AnimationMixer;
  private readonly groups: GroupActions[];
  private readonly concurrent: ClipAction[];
  private readonly layers: AnimationLayers;
  private selectedGroupIndex: number;
  private active: ClipAction | undefined;
  private fade: Crossfade | undefined;
  private time = 0;
  private fixedPrimary: string | undefined;
  private disposed = false;
  private readonly timeScale: number;

  constructor(
    private readonly root: THREE.Object3D,
    primaryClips: readonly THREE.AnimationClip[],
    concurrentClips: readonly THREE.AnimationClip[] = [],
    options: AnimationControllerOptions = {},
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    this.layers = new AnimationLayers(this.mixer, root);
    this.timeScale = Math.max(options.timeScale ?? 1, 0);
    const sourceGroups = options.groups?.length
      ? options.groups
      : [{ name: "default", clips: primaryClips }];
    this.groups = sourceGroups.map((group) => ({
      id: group.id,
      name: group.name,
      clips: group.clips.map((clip, index) => ({
        name: clipKey(clip, index),
        clip,
        action: this.mixer.clipAction(clip),
      })),
    }));
    this.selectedGroupIndex = Math.max(
      this.groups.findIndex((group) => group.id === options.defaultGroupId),
      0,
    );
    this.concurrent = concurrentClips.map((clip, index) => {
      const action = this.mixer.clipAction(clip);
      action.play();
      action.paused = true;
      return { name: clipKey(clip, index), clip, action };
    });
    this.applyTime();
  }

  get clipNames(): readonly string[] {
    return this.selectedGroup.clips.map(({ name }) => name);
  }

  get groupDescriptors(): readonly { id?: number; name: string }[] {
    return this.groups.map(({ id, name }) => ({ id, name }));
  }

  get selectedGroupDescriptor(): { id?: number; name: string } | undefined {
    const group = this.groups[this.selectedGroupIndex];
    return group ? { id: group.id, name: group.name } : undefined;
  }

  get primaryClipName(): string | undefined {
    return (
      this.fixedPrimary ??
      this.selectedGroup.clips[
        sequencePosition(this.selectedGroup.clips, this.time).index
      ]?.name
    );
  }

  update(delta: number): void {
    if (this.disposed) return;
    const elapsed = Math.max(delta, 0) * this.timeScale;
    this.time += elapsed;
    if (this.fade) this.fade.elapsed += elapsed;
    this.layers.advance(elapsed);
    this.applyTime();
  }

  setTime(time: number): void {
    if (this.disposed) return;
    this.cancelFade();
    this.time = Math.max(time, 0) * this.timeScale;
    this.applyTime();
  }

  reset(): void {
    if (this.disposed) return;
    this.cancelFade();
    this.fixedPrimary = undefined;
    this.time = 0;
    this.layers.clear();
    this.stopPrimaryActions();
    this.active = undefined;
    this.applyTime();
  }

  play(name: string): boolean {
    if (this.disposed) return false;
    if (!this.selectedGroup.clips.some((clip) => clip.name === name))
      return false;
    this.cancelFade();
    this.fixedPrimary = name;
    this.time = 0;
    this.applyTime();
    return true;
  }

  crossfade(name: string, duration: number): boolean {
    if (this.disposed) return false;
    const next = this.selectedGroup.clips.find((clip) => clip.name === name);
    if (!next) return false;
    const seconds = Math.max(duration, 0);
    if (!this.active || this.active === next || seconds === 0)
      return this.play(name);
    const from = this.active;
    this.cancelFade();
    this.fadeBetween(from, from.action.time, next, seconds);
    this.fixedPrimary = name;
    this.applyTime();
    return true;
  }

  selectGroup(group: string | number, fadeDuration = 0): boolean {
    if (this.disposed) return false;
    const index = this.groups.findIndex((candidate) =>
      matchesGroup(candidate, group),
    );
    if (index < 0) return false;
    const previous = this.active;
    const previousTime = previous?.action.time ?? 0;
    this.cancelFade();
    this.selectedGroupIndex = index;
    this.fixedPrimary = undefined;
    this.time = 0;
    const next = this.selectedGroup.clips[0];
    const seconds = Math.max(fadeDuration, 0);
    if (previous && next && previous !== next && seconds > 0) {
      this.fadeBetween(previous, previousTime, next, seconds);
    } else {
      this.stopPrimaryActions();
      this.active = undefined;
    }
    this.applyTime();
    return true;
  }

  selectLayer(
    id: string,
    group: string | number,
    mask: AnimationMask,
    fadeDuration = 0,
    weight = 1,
  ): boolean {
    if (this.disposed) return false;
    const source = this.groups.find((candidate) =>
      matchesGroup(candidate, group),
    )?.clips[0];
    if (!source) return false;
    const selected = this.layers.select(
      id,
      source.clip,
      `${String(group)}:${mask}`,
      mask,
      fadeDuration,
      weight,
    );
    if (selected) this.applyTime();
    return selected;
  }

  setLayerTime(id: string, time: number): void {
    if (this.disposed) return;
    if (this.layers.setTime(id, Math.max(time, 0) * this.timeScale))
      this.applyTime();
  }

  clearLayer(id: string, fadeDuration = 0): void {
    if (this.disposed) return;
    if (this.layers.fadeOut(id, fadeDuration)) this.applyTime();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    for (const clip of [...this.primaryActions(), ...this.concurrent])
      this.mixer.uncacheAction(clip.clip, this.root);
    this.layers.dispose();
    this.mixer.uncacheRoot(this.root);
    this.active = undefined;
    this.fade = undefined;
  }

  private get selectedGroup(): GroupActions {
    return (
      this.groups[this.selectedGroupIndex] ?? { name: "default", clips: [] }
    );
  }

  private fadeBetween(
    from: ClipAction,
    fromTime: number,
    to: ClipAction,
    seconds: number,
  ): void {
    this.stopPrimaryActions();
    this.fade = startCrossfade(from, to, fromTime, seconds);
  }

  private primaryPosition(): { index: number; local: number } {
    const primary = this.selectedGroup.clips;
    const fixedIndex = this.fixedPrimary
      ? primary.findIndex(({ name }) => name === this.fixedPrimary)
      : -1;
    const fixed = primary[fixedIndex];
    return fixed
      ? { index: fixedIndex, local: loopTime(this.time, fixed.clip) }
      : sequencePosition(primary, this.time);
  }

  private applyPrimary(): void {
    if (this.fade) {
      if (!applyCrossfade(this.fade)) return;
      this.active = this.fade.to;
      this.fade = undefined;
      return;
    }
    const position = this.primaryPosition();
    const next = this.selectedGroup.clips[position.index];
    if (next !== this.active) {
      this.stopPrimaryActions();
      next?.action.reset().play();
      if (next) {
        next.action.paused = true;
        next.action.setEffectiveWeight(1);
      }
      this.active = next;
    }
    if (next) next.action.time = position.local;
  }

  private applyTime(): void {
    if (this.disposed) return;
    this.applyPrimary();
    for (const concurrent of this.concurrent)
      concurrent.action.time = loopTime(this.time, concurrent.clip);
    this.layers.apply();
    this.mixer.update(0);
  }

  private primaryActions(): ClipAction[] {
    return this.groups.flatMap((group) => group.clips);
  }

  private stopPrimaryActions(): void {
    for (const clip of this.primaryActions()) {
      clip.action.stop();
      clip.action.setEffectiveWeight(1);
    }
  }

  private cancelFade(): void {
    if (!this.fade) return;
    cancelCrossfade(this.fade);
    this.fade = undefined;
  }
}
