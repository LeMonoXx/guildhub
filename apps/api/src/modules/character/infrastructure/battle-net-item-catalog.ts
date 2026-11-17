import type { BlizzardApiClient } from "@blizzard-api/client";
import { wowForever } from "@blizzard-api/wow-forever";
import type { EquippedItem } from "@guildhub/contracts";
import { rec } from "../../../platform/blizzard/document.js";
import { sendBattleNet } from "../../../platform/blizzard/request.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { ItemCatalog } from "../application/ports.js";
import { mapEquippedItem } from "./map-equipped-item.js";

const noIcons: ReadonlyMap<number, number> = new Map();

/**
 * An item document carries the same preview an equipped item does, minus the
 * slot it sits in; its inventory type stands in for that slot.
 */
export function mapItemDocument(value: unknown): EquippedItem | undefined {
  const document = rec(value);
  const preview = rec(document.preview_item);
  return mapEquippedItem(
    {
      level:
        document.level === undefined ? undefined : { value: document.level },
      ...preview,
      item: { id: document.id },
      slot: preview.inventory_type ?? document.inventory_type,
    },
    () => "",
    noIcons,
  );
}

/** Items are static game data, so each locale's answer is kept for the process. */
export function makeBattleNetItemCatalog(
  client: BlizzardApiClient,
): ItemCatalog {
  const known = new Map<string, EquippedItem | null>();
  return {
    async item(itemId, locale) {
      const key = `${locale}:${String(itemId)}`;
      const cached = known.get(key);
      if (cached === null) return err(appError("item.not_found"));
      if (cached !== undefined) return ok(cached);
      const result = await sendBattleNet(client, wowForever.item(itemId), {
        notFound: "item.not_found",
        locale,
      });
      if (!result.ok) {
        if (result.error.code === "item.not_found") known.set(key, null);
        return result;
      }
      const item = mapItemDocument(result.value) ?? null;
      known.set(key, item);
      return item === null ? err(appError("item.not_found")) : ok(item);
    },
  };
}
