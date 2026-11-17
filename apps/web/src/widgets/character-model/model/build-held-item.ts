// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import { AssetStore } from "../lib/asset-store";
import type { AssemblyContext, AssetUrls } from "./assembly-context";
import { CharacterRuntime } from "./model-runtime";
import { mountModel } from "./mount-model";
import { ResourceOwner } from "./resource-owner";

/** Models shown on their own, without a character: a held item or a creature. */
export interface StandaloneModel {
  readonly object: THREE.Group;
  update(delta: number): void;
  dispose(): void;
}

export type HeldItem = StandaloneModel;

const HELD_ITEM_TIME_SCALE = 0.35;
const OBJECT_SKIN_SLOT = 2;

/** One item's meshes, with the same materials as on the character, and no body. */
export const buildHeldItem = (
  models: readonly { fileDataId: number; textureFileDataId?: number }[],
  urls: Pick<AssetUrls, "model" | "texture">,
): Promise<HeldItem> =>
  buildStandaloneModels(
    models.map((model) => {
      const replacements: Record<number, number> = {};
      if (model.textureFileDataId !== undefined)
        replacements[OBJECT_SKIN_SLOT] = model.textureFileDataId;
      return { fileDataId: model.fileDataId, replacements };
    }),
    urls,
    HELD_ITEM_TIME_SCALE,
  );

/** Loads models side by side, each with its texture types replaced by file ids. */
export async function buildStandaloneModels(
  models: readonly {
    fileDataId: number;
    replacements: Record<number, number>;
  }[],
  urls: Pick<AssetUrls, "model" | "texture">,
  timeScale: number,
): Promise<StandaloneModel> {
  const assets = new AssetStore();
  const owner = new ResourceOwner();
  const runtime = new CharacterRuntime();
  const group = new THREE.Group();
  const dispose = () => {
    runtime.dispose();
    owner.dispose();
    assets.dispose();
  };
  const context: AssemblyContext = {
    assets,
    owner,
    notices: [],
    textures: new Map(),
    runtime,
    textureUrl: urls.texture,
    fallback: owner.own(
      new THREE.MeshStandardMaterial({
        color: 0xc4b49a,
        roughness: 0.55,
        metalness: 0.25,
      }),
    ),
  };
  try {
    for (const [index, model] of models.entries()) {
      const loaded = await assets.model(
        urls.model(model.fileDataId, "glb"),
        urls.model(model.fileDataId, "json"),
      );
      await mountModel(
        loaded,
        model.replacements,
        context,
        `held_${String(index)}`,
        { timeScale },
      );
      group.add(loaded.scene);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    object: group,
    update: (delta) => {
      runtime.update(delta);
    },
    dispose,
  };
}
