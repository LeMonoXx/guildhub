import type { ContentLocale, EquippedItem } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type { GetGuildRoster, GuildRef } from "../../guild/index.js";
import type {
  CharacterProfileCache,
  ItemCatalog,
  ItemLookupError,
} from "./ports.js";

interface GetItemDeps {
  readonly items: ItemCatalog;
  readonly getRoster: GetGuildRoster;
  readonly profiles: CharacterProfileCache;
}

/**
 * Battle.net's item data misses some items members wear. Their cached
 * profiles still describe them; durability and enchantments are left out,
 * because those belong to one member's copy, not to the item.
 */
async function wornItem(
  deps: GetItemDeps,
  guild: GuildRef,
  itemId: number,
  locale: ContentLocale,
): Promise<EquippedItem | undefined> {
  const roster = await deps.getRoster(guild);
  if (!roster.ok) return undefined;
  const profiles = await deps.profiles.latestMany(
    roster.value.data.map((member) => member.characterId),
    locale,
  );
  const worn = profiles
    .flatMap((profile) => profile.data.equipment)
    .find((item) => item.itemId === itemId);
  if (worn === undefined) return undefined;
  const item = { ...worn, enchantments: [] };
  delete item.durability;
  return item;
}

export const makeGetItem =
  (deps: GetItemDeps) =>
  async (query: {
    guild: GuildRef;
    itemId: number;
    locale: ContentLocale;
  }): Promise<Result<EquippedItem, ItemLookupError>> => {
    if (!Number.isSafeInteger(query.itemId) || query.itemId <= 0)
      return err(appError("item.not_found"));
    const known = await deps.items.item(query.itemId, query.locale);
    if (known.ok || known.error.code !== "item.not_found") return known;
    const worn = await wornItem(deps, query.guild, query.itemId, query.locale);
    return worn === undefined ? known : ok(worn);
  };

export type GetItem = ReturnType<typeof makeGetItem>;
