import type { ContentLocale, EquippedItem } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, type Result } from "../../../platform/kernel/result.js";
import type { ItemCatalog, ItemLookupError } from "./ports.js";

export const makeGetItem =
  (deps: { items: ItemCatalog }) =>
  async (query: {
    itemId: number;
    locale: ContentLocale;
  }): Promise<Result<EquippedItem, ItemLookupError>> => {
    if (!Number.isSafeInteger(query.itemId) || query.itemId <= 0)
      return err(appError("item.not_found"));
    return deps.items.item(query.itemId, query.locale);
  };

export type GetItem = ReturnType<typeof makeGetItem>;
