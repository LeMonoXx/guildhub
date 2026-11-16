import * as THREE from "three";
import { loopTime } from "./clip-timing";

export type AnimationMask = "upper-body";

const maskRootKeyBones: Record<AnimationMask, number> = {
  "upper-body": 4,
};

interface Layer {
  readonly selection: string;
  readonly clip: THREE.AnimationClip;
  readonly action: THREE.AnimationAction;
  time: number;
  weight: number;
  targetWeight: number;
  fadeFrom: number;
  fadeElapsed: number;
  fadeDuration: number;
}

function fadeTo(layer: Layer, targetWeight: number, duration: number): void {
  layer.fadeFrom = layer.weight;
  layer.targetWeight = THREE.MathUtils.clamp(targetWeight, 0, 1);
  layer.fadeElapsed = 0;
  layer.fadeDuration = Math.max(duration, 0);
  if (layer.fadeDuration === 0) layer.weight = layer.targetWeight;
}

function advanceFade(layer: Layer, elapsed: number): void {
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

/** Additive, bone-masked clips played over the primary animation, each fading on its own. */
export class AnimationLayers {
  private readonly layers = new Map<string, Layer>();
  private readonly clips = new Map<string, THREE.AnimationClip>();

  constructor(
    private readonly mixer: THREE.AnimationMixer,
    private readonly root: THREE.Object3D,
  ) {}

  /** False when the mask leaves no animated bones in the source clip. */
  select(
    id: string,
    source: THREE.AnimationClip,
    selection: string,
    mask: AnimationMask,
    fadeDuration: number,
    weight: number,
  ): boolean {
    const existing = this.layers.get(id);
    if (existing?.selection === selection) {
      fadeTo(existing, weight, fadeDuration);
      return true;
    }
    existing?.action.stop();
    const clip = this.maskedClip(source, selection, mask);
    if (!clip.tracks.length) return false;
    const action = this.mixer.clipAction(clip);
    action.reset().play();
    action.paused = true;
    action.setEffectiveWeight(0);
    const layer: Layer = {
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
    fadeTo(layer, weight, fadeDuration);
    return true;
  }

  setTime(id: string, time: number): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    layer.time = time;
    return true;
  }

  fadeOut(id: string, duration: number): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;
    fadeTo(layer, 0, duration);
    return true;
  }

  advance(elapsed: number): void {
    for (const layer of this.layers.values()) {
      layer.time += elapsed;
      advanceFade(layer, elapsed);
    }
  }

  /** Poses every layer; a layer faded out completely is removed. */
  apply(): void {
    for (const [id, layer] of this.layers) {
      layer.action.time = loopTime(layer.time, layer.clip);
      layer.action.setEffectiveWeight(layer.weight);
      if (layer.weight > 0 || layer.targetWeight > 0) continue;
      layer.action.stop();
      this.layers.delete(id);
    }
  }

  clear(): void {
    for (const layer of this.layers.values()) layer.action.stop();
    this.layers.clear();
  }

  dispose(): void {
    for (const clip of this.clips.values())
      this.mixer.uncacheAction(clip, this.root);
    this.layers.clear();
    this.clips.clear();
  }

  private maskedClip(
    source: THREE.AnimationClip,
    selection: string,
    mask: AnimationMask,
  ): THREE.AnimationClip {
    const key = `${source.uuid}:${selection}`;
    const cached = this.clips.get(key);
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
    this.clips.set(key, clip);
    return clip;
  }

  private maskNodes(mask: AnimationMask): ReadonlySet<string> {
    const nodes = new Set<string>();
    const rootKeyBoneId = maskRootKeyBones[mask];
    this.root.traverse((candidate) => {
      if (candidate.userData["keyBoneId"] !== rootKeyBoneId) return;
      candidate.traverse((descendant) => nodes.add(descendant.name));
    });
    return nodes;
  }
}
