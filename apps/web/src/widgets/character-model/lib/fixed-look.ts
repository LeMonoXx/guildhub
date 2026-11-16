import type { FixedLookManifest } from "../model/types";

export const assetUrl = (relativePath: string): string =>
  `/assets/${relativePath.replace(/^\/+/, "")}`;

export async function loadFixedLook(
  fetcher: typeof fetch = fetch,
): Promise<FixedLookManifest> {
  const currentResponse = await fetcher("/assets/current.json");
  if (!currentResponse.ok)
    throw new Error(`current manifest: HTTP ${String(currentResponse.status)}`);
  const current = (await currentResponse.json()) as {
    fixedLook?: unknown;
  };
  if (typeof current.fixedLook !== "string")
    throw new Error("current manifest has no fixedLook path");

  const lookResponse = await fetcher(assetUrl(current.fixedLook));
  if (!lookResponse.ok)
    throw new Error(`fixed look: HTTP ${String(lookResponse.status)}`);
  const manifest = (await lookResponse.json()) as FixedLookManifest;
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.body.path ||
    !manifest.bodyMetadata ||
    !Array.isArray(manifest.items)
  )
    throw new Error("unsupported fixed-look manifest");
  return manifest;
}
