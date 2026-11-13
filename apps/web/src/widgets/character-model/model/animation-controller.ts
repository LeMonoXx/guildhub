// Deterministic multi-clip sequencing is adapted from Altrobe commit
// b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import type { TimelineParticipant } from "./lifecycle";

const clipKey = (clip: THREE.AnimationClip, index: number) =>
  clip.name || `clip-${String(index)}`;

const animationMaskRootKeyBones = {
  "upper-body": 4,
} as const;

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

export type AnimationMask = "upper-body";

interface ClipAction {
  name: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
}

interface GroupActions {
  id?: number;
  name: string;
  clips: ClipAction[];
}

interface CrossfadeState {
  from: ClipAction;
  to: ClipAction;
  fromTime: number;
  elapsed: number;
  duration: number;
}

interface LayerState {
  selection: string;
  clip: THREE.AnimationClip;
  action: THREE.AnimationAction;
  time: number;
  weight: number;
  targetWeight: number;
  fadeFrom: number;
  fadeElapsed: number;
  fadeDuration: number;
}

export class AnimationController implements TimelineParticipant {
  private readonly mixer: THREE.AnimationMixer;
  private readonly groups: GroupActions[];
  private readonly concurrent: ClipAction[];
  private selectedGroupIndex: number;
  private active: ClipAction | undefined;
  private fade: CrossfadeState | undefined;
  private readonly layers = new Map<string, LayerState>();
  private readonly layerClips = new Map<string, THREE.AnimationClip>();
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
    this.timeScale = Math.max(options.timeScale ?? 1, 0);
    const sourceGroups = options.groups?.length
      ? options.groups
      : [{ name: "default", clips: primaryClips }];
    this.groups = sourceGroups.map((group) => {
      const clips = group.clips.map((clip, index) => ({
        name: clipKey(clip, index),
        clip,
        action: this.mixer.clipAction(clip),
      }));
      return { id: group.id, name: group.name, clips };
    });
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
      this.selectedGroup.clips[this.sequencePosition(this.time).index]?.name
    );
  }

  update(delta: number): void {
    if (this.disposed) return;
    const elapsed = Math.max(delta, 0) * this.timeScale;
    this.time += elapsed;
    if (this.fade) this.fade.elapsed += elapsed;
    for (const layer of this.layers.values()) {
      layer.time += elapsed;
      this.advanceLayerFade(layer, elapsed);
    }
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
    for (const layer of this.layers.values()) layer.action.stop();
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
    this.cancelFade();
    const fromTime = this.active.action.time;
    this.stopPrimaryActions();
    this.active.action.reset().play();
    this.active.action.paused = true;
    this.active.action.time = fromTime;
    this.active.action.setEffectiveWeight(1);
    next.action.reset().play();
    next.action.paused = true;
    next.action.setEffectiveWeight(0);
    this.fade = {
      from: this.active,
      to: next,
      fromTime,
      elapsed: 0,
      duration: seconds,
    };
    this.fixedPrimary = name;
    this.applyTime();
    return true;
  }

  selectGroup(group: string | number, fadeDuration = 0): boolean {
    if (this.disposed) return false;
    const index = this.groups.findIndex((candidate) =>
      typeof group === "number"
        ? candidate.id === group
        : candidate.name === group,
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
      this.stopPrimaryActions();
      previous.action.reset().play();
      previous.action.paused = true;
      previous.action.time = previousTime;
      previous.action.setEffectiveWeight(1);
      next.action.reset().play();
      next.action.paused = true;
      next.action.setEffectiveWeight(0);
      this.fade = {
        from: previous,
        to: next,
        fromTime: previousTime,
        elapsed: 0,
        duration: seconds,
      };
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
    const sourceGroup = this.groups.find((candidate) =>
      typeof group === "number"
        ? candidate.id === group
        : candidate.name === group,
    );
    const source = sourceGroup?.clips[0];
    if (!source) return false;
    const selection = `${String(group)}:${mask}`;
    const existing = this.layers.get(id);
    if (existing?.selection === selection) {
      this.fadeLayer(existing, weight, fadeDuration);
      return true;
    }
    existing?.action.stop();
    const clip = this.layerClip(source.clip, selection, mask);
    if (!clip.tracks.length) return false;
    const action = this.mixer.clipAction(clip);
    action.reset().play();
    action.paused = true;
    action.setEffectiveWeight(0);
    const layer: LayerState = {
      selection,
      clip,
      action,
      time: 0,
      weight: 0,
      targetWeight: 0,
      fadeFrom: 0,
      fadeElapsed: 0,
      fadeDuration: 0,
    };
    this.layers.set(id, layer);
    this.fadeLayer(layer, weight, fadeDuration);
    this.applyTime();
    return true;
  }

  setLayerTime(id: string, time: number): void {
    if (this.disposed) return;
    const layer = this.layers.get(id);
    if (!layer) return;
    layer.time = Math.max(time, 0) * this.timeScale;
    this.applyTime();
  }

  clearLayer(id: string, fadeDuration = 0): void {
    if (this.disposed) return;
    const layer = this.layers.get(id);
    if (!layer) return;
    this.fadeLayer(layer, 0, fadeDuration);
    this.applyTime();
  }

  private get selectedGroup(): GroupActions {
    return (
      this.groups[this.selectedGroupIndex] ?? {
        name: "default",
        clips: [],
      }
    );
  }

  private sequencePosition(time: number): { index: number; local: number } {
    const primary = this.selectedGroup.clips;
    if (!primary.length) return { index: -1, local: 0 };
    const durations = primary.map(({ clip }) => Math.max(clip.duration, 0.001));
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    let local = ((time % total) + total) % total;
    for (let index = 0; index < durations.length; index += 1) {
      const duration = durations[index] ?? 0.001;
      if (local < duration || index === durations.length - 1)
        return { index, local };
      local -= duration;
    }
    return { index: 0, local: 0 };
  }

  private applyTime(): void {
    if (this.disposed) return;
    if (this.fade) {
      this.applyFade(this.fade);
      this.applyConcurrent();
      this.applyLayers();
      this.mixer.update(0);
      return;
    }
    const primary = this.selectedGroup.clips;
    const fixedIndex = this.fixedPrimary
      ? primary.findIndex(({ name }) => name === this.fixedPrimary)
      : -1;
    const position =
      fixedIndex >= 0
        ? {
            index: fixedIndex,
            local:
              this.time %
              Math.max(primary[fixedIndex]?.clip.duration ?? 0, 0.001),
          }
        : this.sequencePosition(this.time);
    const next = primary[position.index];
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
    this.applyConcurrent();
    this.applyLayers();
    this.mixer.update(0);
  }

  private applyFade(fade: CrossfadeState): void {
    const factor = Math.min(fade.elapsed / fade.duration, 1);
    fade.from.action.time =
      (fade.fromTime + fade.elapsed) % Math.max(fade.from.clip.duration, 0.001);
    fade.to.action.time = fade.elapsed % Math.max(fade.to.clip.duration, 0.001);
    fade.from.action.setEffectiveWeight(1 - factor);
    fade.to.action.setEffectiveWeight(factor);
    if (factor < 1) return;
    fade.from.action.stop();
    fade.to.action.setEffectiveWeight(1);
    this.active = fade.to;
    this.fade = undefined;
  }

  private applyConcurrent(): void {
    for (const concurrent of this.concurrent)
      concurrent.action.time =
        this.time % Math.max(concurrent.clip.duration, 0.001);
  }

  private applyLayers(): void {
    for (const [id, layer] of this.layers) {
      layer.action.time = layer.time % Math.max(layer.clip.duration, 0.001);
      layer.action.setEffectiveWeight(layer.weight);
      if (layer.weight > 0 || layer.targetWeight > 0) continue;
      layer.action.stop();
      this.layers.delete(id);
    }
  }

  private fadeLayer(
    layer: LayerState,
    targetWeight: number,
    duration: number,
  ): void {
    layer.fadeFrom = layer.weight;
    layer.targetWeight = THREE.MathUtils.clamp(targetWeight, 0, 1);
    layer.fadeElapsed = 0;
    layer.fadeDuration = Math.max(duration, 0);
    if (layer.fadeDuration === 0) layer.weight = layer.targetWeight;
  }

  private advanceLayerFade(layer: LayerState, elapsed: number): void {
    if (layer.weight === layer.targetWeight) return;
    layer.fadeElapsed += elapsed;
    const factor =
      layer.fadeDuration === 0
        ? 1
        : Math.min(layer.fadeElapsed / layer.fadeDuration, 1);
    layer.weight = THREE.MathUtils.lerp(
      layer.fadeFrom,
      layer.targetWeight,
      factor,
    );
  }

  private layerClip(
    source: THREE.AnimationClip,
    selection: string,
    mask: AnimationMask,
  ): THREE.AnimationClip {
    const key = `${source.uuid}:${selection}`;
    const cached = this.layerClips.get(key);
    if (cached) return cached;
    const nodes = this.maskNodes(mask);
    const tracks = source.tracks
      .filter((track) => nodes.has(track.name.split(".")[0] ?? ""))
      .map((track) => track.clone());
    const clip = new THREE.AnimationClip(
      `${source.name}:${selection}`,
      source.duration,
      tracks,
    );
    THREE.AnimationUtils.makeClipAdditive(clip, 0, clip);
    this.layerClips.set(key, clip);
    return clip;
  }

  private maskNodes(mask: AnimationMask): ReadonlySet<string> {
    const nodes = new Set<string>();
    const rootKeyBoneId = animationMaskRootKeyBones[mask];
    this.root.traverse((candidate) => {
      if (candidate.userData["keyBoneId"] !== rootKeyBoneId) return;
      candidate.traverse((descendant) => nodes.add(descendant.name));
    });
    return nodes;
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
    this.fade.from.action.stop();
    this.fade.to.action.stop();
    this.fade = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    for (const clip of [...this.primaryActions(), ...this.concurrent])
      this.mixer.uncacheAction(clip.clip, this.root);
    for (const clip of this.layerClips.values())
      this.mixer.uncacheAction(clip, this.root);
    this.mixer.uncacheRoot(this.root);
    this.layers.clear();
    this.layerClips.clear();
    this.active = undefined;
    this.fade = undefined;
  }
}
