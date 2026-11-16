import type { CinematicScene } from "@guildhub/contracts";

/** A scene given inline is used as is; a URL is fetched. */
export const loadScene = async (
  source: string | CinematicScene,
  fetchImpl: typeof fetch = fetch,
): Promise<CinematicScene> => {
  if (typeof source !== "string") return source;
  const response = await fetchImpl(source);
  if (!response.ok)
    throw new Error(`cinematic scene: HTTP ${String(response.status)}`);
  return (await response.json()) as CinematicScene;
};
