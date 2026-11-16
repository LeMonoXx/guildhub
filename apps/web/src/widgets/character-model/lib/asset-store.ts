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

/** Settled requests count whole; a download in flight counts by its bytes. */
export interface AssetProgress {
  readonly requested: number;
  readonly settled: number;
  readonly fraction: number;
}

type ProgressListener = (progress: AssetProgress) => void;

async function readBody(
  response: Response,
  onFraction: (fraction: number) => void,
): Promise<ArrayBuffer> {
  const total = Number(response.headers.get("content-length"));
  if (!response.body || !Number.isFinite(total) || total <= 0)
    return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    // A compressed response announces fewer bytes than it delivers.
    onFraction(Math.min(received / total, 1));
  }
  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
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
  private readonly inFlight = new Map<string, number>();
  private readonly listeners = new Set<ProgressListener>();
  private requested = 0;
  private settled = 0;
  private disposed = false;

  constructor(options: AssetStoreOptions = {}) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.gltfLoader = options.gltfLoader ?? new GLTFLoader();
    this.textureLoader = options.textureLoader ?? new THREE.TextureLoader();
  }

  progress(): AssetProgress {
    let partial = 0;
    for (const fraction of this.inFlight.values()) partial += fraction;
    return {
      requested: this.requested,
      settled: this.settled,
      fraction:
        this.requested === 0 ? 0 : (this.settled + partial) / this.requested,
    };
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const progress = this.progress();
    for (const listener of this.listeners) listener(progress);
  }

  private track(key: string, fraction: number): void {
    if (!this.inFlight.has(key)) return;
    this.inFlight.set(key, fraction);
    this.emit();
  }

  loadOnce<T>(url: string, load: () => Promise<T>): Promise<T> {
    if (this.disposed)
      return Promise.reject(
        new Error("Cannot load from a disposed AssetStore"),
      );
    const existing = this.requests.get(url);
    if (existing) return existing as Promise<T>;
    this.requested += 1;
    this.inFlight.set(url, 0);
    this.emit();
    const settle = () => {
      this.inFlight.delete(url);
      this.settled += 1;
      this.emit();
    };
    const pending = load().then(
      (value) => {
        settle();
        return value;
      },
      (error: unknown) => {
        this.requests.delete(url);
        settle();
        throw error;
      },
    );
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
    const key = `gltf:${url}`;
    return this.loadOnce(key, async () => {
      const response = await this.fetcher(url);
      if (!response.ok)
        throw new Error(`${url}: HTTP ${String(response.status)}`);
      const gltf = await this.gltfLoader.parseAsync(
        await readBody(response, (fraction) => {
          this.track(key, fraction * 0.9);
        }),
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
    const key = `texture:${url}`;
    return this.loadOnce(key, async () => {
      const texture = await this.textureLoader.loadAsync(url, (event) => {
        if (event.lengthComputable && event.total > 0)
          this.track(key, event.loaded / event.total);
      });
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
    this.inFlight.clear();
    this.listeners.clear();
  }
}
