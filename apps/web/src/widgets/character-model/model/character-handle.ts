import * as THREE from "three";
import type { Disposable } from "./lifecycle";
import type { CharacterRuntime } from "./model-runtime";
import { ResourceOwner } from "./resource-owner";

export interface CharacterHandle {
  readonly root: THREE.Object3D;
  readonly box: THREE.Box3;
  readonly notices: readonly string[];
  readonly clipNames: readonly string[];
  readonly primaryClipName: string | undefined;
  readonly animationGroups: readonly { id?: number; name: string }[];
  readonly selectedAnimationGroup: { id?: number; name: string } | undefined;
  update(delta: number): void;
  setTime(time: number): void;
  seek(time: number): void;
  reset(): void;
  play(clip: string): boolean;
  crossfade(clip: string, duration: number): boolean;
  selectAnimationGroup(group: string | number, fadeDuration?: number): boolean;
  faceCamera(camera: THREE.Camera): void;
  dispose(): void;
}

export class CharacterModelHandle implements CharacterHandle {
  private disposed = false;

  constructor(
    readonly root: THREE.Object3D,
    readonly box: THREE.Box3,
    readonly notices: readonly string[],
    private readonly runtime: CharacterRuntime,
    private readonly owner: ResourceOwner,
    private readonly assets?: Disposable,
  ) {}

  get clipNames(): readonly string[] {
    return this.runtime.primary?.clipNames ?? [];
  }

  get primaryClipName(): string | undefined {
    return this.runtime.primary?.primaryClipName;
  }

  get animationGroups(): readonly { id?: number; name: string }[] {
    return this.runtime.primary?.groupDescriptors ?? [];
  }

  get selectedAnimationGroup(): { id?: number; name: string } | undefined {
    return this.runtime.primary?.selectedGroupDescriptor;
  }

  update(delta: number): void {
    if (this.disposed) return;
    this.runtime.update(delta);
  }

  setTime(time: number): void {
    if (this.disposed) return;
    this.runtime.setTime(time);
  }

  seek(time: number): void {
    this.setTime(time);
  }

  reset(): void {
    if (this.disposed) return;
    this.runtime.reset();
  }

  play(clip: string): boolean {
    return this.runtime.primary?.play(clip) ?? false;
  }

  crossfade(clip: string, duration: number): boolean {
    return this.runtime.primary?.crossfade(clip, duration) ?? false;
  }

  selectAnimationGroup(group: string | number, fadeDuration = 0): boolean {
    return this.runtime.selectPrimaryGroup(group, fadeDuration);
  }

  faceCamera(camera: THREE.Camera): void {
    if (!this.disposed) this.runtime.faceCamera(camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime.dispose();
    this.owner.dispose();
    this.assets?.dispose();
  }
}
