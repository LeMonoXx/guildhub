import type { CharacterMediaGateway } from "../application/ports.js";

export function makeHttpCharacterMediaGateway(config: {
  /**
   * Battle.net render host prefixes, tried in order, e.g. `.../forever-eu`
   * then `.../eu`. The Forever host lacks some icons the retail host has.
   */
  iconBaseUrls: readonly string[];
}): CharacterMediaGateway {
  return {
    fetchRender: (url) => fetchImage(url),
    fetchIcon: async (iconId) => {
      const file = `icons/56/${String(Math.trunc(iconId))}.jpg`;
      for (const base of config.iconBaseUrls) {
        const image = await fetchImage(`${base}/${file}`);
        if (image) return image;
      }
      return undefined;
    },
  };
}

async function fetchImage(
  url: string,
): Promise<{ body: Uint8Array; contentType: string } | undefined> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return undefined;
  }
  const response = await fetch(parsed);
  if (!response.ok) return undefined;
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) return undefined;
  return {
    body: new Uint8Array(await response.arrayBuffer()),
    contentType,
  };
}
