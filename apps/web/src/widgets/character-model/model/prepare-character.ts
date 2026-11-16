import type { FixedLookManifest } from "./types";
import { AssetStore } from "../lib/asset-store";
import {
  assertFixedLookManifest,
  fetchFixedLook,
  lookAssets,
} from "../lib/look-assets";
import { buildCharacter } from "./assemble-character";
import type { CharacterModelHandle } from "./character-handle";
import { dress } from "./dress";

export interface PrepareCharacterOptions {
  readonly manifest: string | FixedLookManifest;
  readonly assetBase: string;
  readonly fetch?: typeof fetch;
  readonly sharedAssets?: AssetStore;
}

export interface PreparedCharacter {
  readonly character: CharacterModelHandle;
  readonly manifest: FixedLookManifest;
}

export async function prepareCharacter(
  options: PrepareCharacterOptions,
): Promise<PreparedCharacter> {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const manifest =
    typeof options.manifest === "string"
      ? await fetchFixedLook(options.manifest, fetcher)
      : assertFixedLookManifest(options.manifest);
  const { asset, model, texture } = lookAssets(manifest, options.assetBase);
  const defaultAnimation =
    manifest.animations.find((animation) => animation.id === 0) ??
    manifest.animations[0];

  const character = await buildCharacter(
    manifest.look,
    dress(manifest.look, manifest.items),
    {
      bodyModel: asset(manifest.body.path),
      bodyMetadata: asset(manifest.bodyMetadata),
      animations: manifest.animations.map((animation) => ({
        id: animation.id,
        name: animation.name,
        url: asset(animation.path),
      })),
      defaultAnimationId: defaultAnimation?.id,
      model,
      texture,
    },
    options.sharedAssets,
  );
  return { character, manifest };
}
