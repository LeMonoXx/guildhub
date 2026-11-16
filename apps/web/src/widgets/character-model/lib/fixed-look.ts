import type { FixedLookManifest } from "../model/types";
import { fetchFixedLook } from "./look-assets";

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
  return fetchFixedLook(assetUrl(current.fixedLook), fetcher);
}
