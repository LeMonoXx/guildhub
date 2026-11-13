import type { FixedLookManifest } from "../../../types";
import { AssetStore } from "../lib/asset-store";
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

const resolveAsset = (base: string, path: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("/")) return path;
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;
};

const loadManifest = async (
  source: string | FixedLookManifest,
  fetcher: typeof fetch,
): Promise<FixedLookManifest> => {
  if (typeof source !== "string") return source;
  const response = await fetcher(source);
  if (!response.ok)
    throw new Error(`fixed look: HTTP ${String(response.status)}`);
  return (await response.json()) as FixedLookManifest;
};

export async function prepareCharacter(
  options: PrepareCharacterOptions,
): Promise<PreparedCharacter> {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const manifest = await loadManifest(options.manifest, fetcher);
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.body.path ||
    !manifest.bodyMetadata ||
    !Array.isArray(manifest.items)
  )
    throw new Error("unsupported fixed-look manifest");

  const modelDirectory = manifest.body.path.replace(/[^/]+$/, "");
  const textureDirectory = modelDirectory.replace(/models\/$/, "textures/");
  const asset = (path: string) => resolveAsset(options.assetBase, path);
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
      model: (id, extension) =>
        asset(`${modelDirectory}${String(id)}.${extension}`),
      texture: (id) => asset(`${textureDirectory}${String(id)}.png`),
    },
    options.sharedAssets,
  );
  return { character, manifest };
}
