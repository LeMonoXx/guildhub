import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import { rec } from "../../../platform/blizzard/document.js";
import {
  sendBattleNetPatiently,
  type BattleNetResource,
} from "../../../platform/blizzard/request.js";

/** Leaves room for profile refreshes that share the same API quota. */
export const REQUEST_CONCURRENCY = 4;

/** Reads one game data document; anything but an answer is `undefined`. */
export type GetGameData = (
  resource: BattleNetResource,
  locale: ContentLocale,
) => Promise<Record<string, unknown> | undefined>;

export const makeGetGameData =
  (client: BlizzardApiClient): GetGameData =>
  async (resource, locale) => {
    const result = await sendBattleNetPatiently(client, resource, {
      locale,
      notFound: "request.not_found",
    });
    return result.ok ? rec(result.value) : undefined;
  };
