// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import type * as THREE from "three";
import type { AssetStore } from "../lib/asset-store";
import type { CharacterRuntime } from "./model-runtime";
import type { ResourceOwner } from "./resource-owner";

export interface AssetUrls {
  bodyModel: string;
  bodyMetadata: string;
  animations?: readonly { id: number; name: string; url: string }[];
  defaultAnimationId?: number;
  model: (fileDataId: number, extension: "glb" | "json") => string;
  texture: (fileDataId: number) => string;
}

/** Everything one assembly shares: loaders, ownership, diagnostics and the composited skin. */
export interface AssemblyContext {
  readonly assets: AssetStore;
  readonly owner: ResourceOwner;
  readonly notices: string[];
  readonly textures: ReadonlyMap<number, THREE.DataTexture>;
  readonly runtime: CharacterRuntime;
  readonly textureUrl: (fileDataId: number) => string;
  readonly fallback: THREE.Material;
}

const isMesh = (object: THREE.Object3D): object is THREE.Mesh =>
  "isMesh" in object && object.isMesh === true;

export function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (isMesh(object)) result.push(object);
  });
  return result;
}

export const submeshData = (
  object: THREE.Object3D,
): { geosetId?: number; submeshIndex?: number } => ({
  ...object.parent?.userData,
  ...object.userData,
});

/** The baker skips textures the CDN cannot serve; the mesh keeps the fallback. */
export async function optionalTexture(
  context: AssemblyContext,
  fileDataId: number,
): Promise<THREE.Texture | undefined> {
  try {
    return await context.assets.texture(context.textureUrl(fileDataId));
  } catch {
    context.notices.push(`texture ${String(fileDataId)} is unavailable`);
    return undefined;
  }
}
