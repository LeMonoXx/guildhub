import type { BlizzardApiClient } from "@blizzard-api/client";
import { iconIdOf } from "../../../platform/blizzard/document.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { sendCharacterRequest } from "./battle-net-request.js";
import { itemMediaEndpoint } from "./wow-forever-character.js";

const REQUEST_CONCURRENCY = 6;

/** Item media is static game data, so icon ids stay valid for the process. */
export function makeItemIcons(client: BlizzardApiClient) {
  const iconIds = new Map<number, number | undefined>();
  return async (
    mediaIds: readonly number[],
  ): Promise<ReadonlyMap<number, number>> => {
    const missing = mediaIds.filter((id) => !iconIds.has(id));
    await mapLimited(missing, REQUEST_CONCURRENCY, async (id) => {
      const media = await sendCharacterRequest(client, itemMediaEndpoint(id));
      if (!media.ok && media.error.code !== "character.not_found") return;
      iconIds.set(id, media.ok ? iconIdOf(media.value) : undefined);
    });
    const known = new Map<number, number>();
    for (const [mediaId, iconId] of iconIds) {
      if (iconId !== undefined) known.set(mediaId, iconId);
    }
    return known;
  };
}
