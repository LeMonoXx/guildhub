// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import { AssetStore } from "../lib/asset-store";
import { compositeLook } from "../lib/compositor";
import type { AnimationOptions } from "./animation-plan";
import {
  meshes,
  submeshData,
  type AssemblyContext,
  type AssetUrls,
} from "./assembly-context";
import { attachItems } from "./attach-items";
import { CharacterModelHandle } from "./character-handle";
import type { Dressed } from "./dress";
import { CharacterRuntime } from "./model-runtime";
import { mountModel } from "./mount-model";
import { ResourceOwner } from "./resource-owner";
import type { CharacterLook } from "./types";

export interface CharacterBuildOptions {
  itemAnimationSpeed?: number;
}

const DEFAULT_ITEM_ANIMATION_SPEED = 0.5;

async function compositedSkin(
  look: CharacterLook,
  dressed: Dressed,
  urls: AssetUrls,
  owner: ResourceOwner,
): Promise<Map<number, THREE.DataTexture>> {
  const composited = await compositeLook(
    { textures: look.textures, layers: [...look.layers, ...dressed.layers] },
    urls.texture,
  );
  const textures = new Map<number, THREE.DataTexture>();
  for (const [type, texture] of composited) {
    const map = owner.own(
      new THREE.DataTexture(
        texture.pixels,
        texture.width,
        texture.height,
        THREE.RGBAFormat,
      ),
    );
    map.flipY = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    textures.set(type, map);
  }
  return textures;
}

async function bodyAnimations(
  urls: AssetUrls,
  assets: AssetStore,
): Promise<AnimationOptions | undefined> {
  const groups = await Promise.all(
    (urls.animations ?? []).map(async ({ id, name, url }) => ({
      id,
      name,
      clips: await assets.animation(url),
    })),
  );
  return groups.length
    ? { groups, defaultGroupId: urls.defaultAnimationId }
    : undefined;
}

function showDressedGeosets(body: THREE.Object3D, geosets: Iterable<number>) {
  const visible = new Set(geosets);
  for (const mesh of meshes(body)) {
    const { geosetId } = submeshData(mesh);
    mesh.visible = geosetId === undefined || visible.has(geosetId);
  }
}

export async function buildCharacter(
  look: CharacterLook,
  dressed: Dressed,
  urls: AssetUrls,
  sharedAssets?: AssetStore,
  options: CharacterBuildOptions = {},
): Promise<CharacterModelHandle> {
  const assets = sharedAssets ?? new AssetStore();
  const ownedAssets = sharedAssets ? undefined : assets;
  const owner = new ResourceOwner();
  const runtime = new CharacterRuntime();
  try {
    const [body, textures, animations] = await Promise.all([
      assets.model(urls.bodyModel, urls.bodyMetadata),
      compositedSkin(look, dressed, urls, owner),
      bodyAnimations(urls, assets),
    ]);
    const context: AssemblyContext = {
      assets,
      owner,
      notices: [...dressed.notes],
      textures,
      runtime,
      textureUrl: urls.texture,
      fallback: owner.own(
        new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.85 }),
      ),
    };
    await mountModel(
      body,
      dressed.replaceableTextures,
      context,
      undefined,
      animations,
    );
    showDressedGeosets(body.scene, dressed.geosets);
    await attachItems(body.scene, dressed.attachments, {
      ...context,
      modelUrl: urls.model,
      timeScale: options.itemAnimationSpeed ?? DEFAULT_ITEM_ANIMATION_SPEED,
    });
    return new CharacterModelHandle(
      body.scene,
      new THREE.Box3().setFromObject(body.scene),
      context.notices,
      runtime,
      owner,
      ownedAssets,
    );
  } catch (error) {
    runtime.dispose();
    owner.dispose();
    ownedAssets?.dispose();
    throw error;
  }
}
