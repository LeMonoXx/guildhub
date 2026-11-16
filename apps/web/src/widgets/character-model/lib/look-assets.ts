import type { FixedLookManifest } from "../model/types";

export const resolveAsset = (base: string, path: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith("/")) return path;
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;
};

/** Throws unless the document is a fixed look this viewer can read. */
export function assertFixedLookManifest(
  manifest: FixedLookManifest,
): FixedLookManifest {
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.body.path ||
    !manifest.bodyMetadata ||
    !Array.isArray(manifest.items)
  )
    throw new Error("unsupported fixed-look manifest");
  return manifest;
}

export async function fetchFixedLook(
  url: string,
  fetcher: typeof fetch,
): Promise<FixedLookManifest> {
  const response = await fetcher(url);
  if (!response.ok)
    throw new Error(`fixed look: HTTP ${String(response.status)}`);
  return assertFixedLookManifest((await response.json()) as FixedLookManifest);
}

export interface LookAssets {
  readonly asset: (path: string) => string;
  readonly model: (id: number, extension: string) => string;
  readonly texture: (id: number) => string;
}

/** Item models sit beside the body model; their textures in the sibling textures folder. */
export function lookAssets(
  manifest: FixedLookManifest,
  assetBase: string,
): LookAssets {
  const modelDirectory = manifest.body.path.replace(/[^/]+$/, "");
  const textureDirectory = modelDirectory.replace(/models\/$/, "textures/");
  const asset = (path: string) => resolveAsset(assetBase, path);
  return {
    asset,
    model: (id, extension) =>
      asset(`${modelDirectory}${String(id)}.${extension}`),
    texture: (id) => asset(`${textureDirectory}${String(id)}.png`),
  };
}
