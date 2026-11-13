// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { ModelMeta } from "../../../types";
import type { Disposable } from "../model/lifecycle";
import { ResourceOwner } from "../model/resource-owner";

export interface LoadedModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  metadata: ModelMeta;
}

export interface AssetStoreOptions {
  fetch?: typeof fetch;
  gltfLoader?: GLTFLoader;
  textureLoader?: THREE.TextureLoader;
}

const materialsOf = (material: THREE.Material | THREE.Material[]) =>
  Array.isArray(material) ? material : [material];

const clipSeconds = (durationMs: number) => Math.max(durationMs, 1) / 1000;

function clonedAnimations(gltf: GLTF): THREE.AnimationClip[] {
  const definitions = (
    gltf.parser as unknown as {
      json?: { animations?: { extras?: { durationMs?: number } }[] };
    }
  ).json?.animations;
  return gltf.animations.map((source, index) => {
    const clip = source.clone();
    const durationMs = definitions?.[index]?.extras?.durationMs;
    if (durationMs !== undefined) clip.duration = clipSeconds(durationMs);
    return clip;
  });
}

export class AssetStore implements Disposable {
  private readonly requests = new Map<string, Promise<unknown>>();
  private readonly owner = new ResourceOwner();
  private readonly fetcher: typeof fetch;
  private readonly gltfLoader: GLTFLoader;
  private readonly textureLoader: THREE.TextureLoader;
  private disposed = false;

  constructor(options: AssetStoreOptions = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.gltfLoader = options.gltfLoader ?? new GLTFLoader();
    this.textureLoader = options.textureLoader ?? new THREE.TextureLoader();
  }

  loadOnce<T>(url: string, load: () => Promise<T>): Promise<T> {
    if (this.disposed)
      return Promise.reject(
        new Error("Cannot load from a disposed AssetStore"),
      );
    const existing = this.requests.get(url);
    if (existing) return existing as Promise<T>;
    const pending = load().catch((error: unknown) => {
      this.requests.delete(url);
      throw error;
    });
    this.requests.set(url, pending);
    return pending;
  }

  private async json<T>(url: string): Promise<T> {
    return this.loadOnce(`json:${url}`, async () => {
      const response = await this.fetcher(url);
      if (!response.ok)
        throw new Error(`${url}: HTTP ${String(response.status)}`);
      return (await response.json()) as T;
    });
  }

  private async gltf(url: string): Promise<GLTF> {
    return this.loadOnce(`gltf:${url}`, async () => {
      const response = await this.fetcher(url);
      if (!response.ok)
        throw new Error(`${url}: HTTP ${String(response.status)}`);
      const gltf = await this.gltfLoader.parseAsync(
        await response.arrayBuffer(),
        "",
      );
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const mesh = object as unknown as THREE.Mesh;
        this.owner.own(mesh.geometry);
        for (const material of materialsOf(mesh.material))
          this.owner.own(material);
      });
      return gltf;
    });
  }

  async model(modelUrl: string, metadataUrl: string): Promise<LoadedModel> {
    const [gltf, metadata] = await Promise.all([
      this.gltf(modelUrl),
      this.json<ModelMeta>(metadataUrl),
    ]);
    return {
      scene: clone(gltf.scene),
      animations: clonedAnimations(gltf),
      metadata,
    };
  }

  async animation(url: string): Promise<THREE.AnimationClip[]> {
    return clonedAnimations(await this.gltf(url));
  }

  texture(url: string): Promise<THREE.Texture> {
    return this.loadOnce(`texture:${url}`, async () => {
      const texture = await this.textureLoader.loadAsync(url);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      return this.owner.own(texture);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.owner.dispose();
    this.requests.clear();
  }
}
