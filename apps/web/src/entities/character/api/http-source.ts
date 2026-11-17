import {
  characterDetailResponseSchema,
  characterHistoryResponseSchema,
  characterProfileResponseSchema,
  equippedItemSchema,
} from "@guildhub/contracts";
import { ApiError, getJson } from "../../../shared/api";
import { CharacterNotFoundError, type CharacterDataSource } from "./source";

const notFoundAware = async <T>(slug: string, load: () => Promise<T>) => {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && error.code === "character.not_found") {
      throw new CharacterNotFoundError(slug);
    }
    throw error;
  }
};

const characterPath = (slug: string) =>
  `/api/characters/${encodeURIComponent(slug)}`;

export const createHttpCharacterSource = (): CharacterDataSource => ({
  getBySlug: (slug) =>
    notFoundAware(slug, () =>
      getJson(characterPath(slug), characterDetailResponseSchema),
    ),
  getProfile: (slug) =>
    notFoundAware(slug, () =>
      getJson(`${characterPath(slug)}/profile`, characterProfileResponseSchema),
    ),
  getHistory: (slug) =>
    getJson(`${characterPath(slug)}/history`, characterHistoryResponseSchema),
  getItem: (itemId) =>
    getJson(`/api/items/${String(itemId)}`, equippedItemSchema),
});
