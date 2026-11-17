import type {
  CharacterDetailResponse,
  CharacterHistoryResponse,
  CharacterProfileResponse,
  EquippedItem,
} from "@guildhub/contracts";

export class CharacterNotFoundError extends Error {
  readonly code = "character-not-found";

  constructor(slug: string) {
    super(`No character for slug "${slug}"`);
    this.name = "CharacterNotFoundError";
  }
}

export interface CharacterDataSource {
  getBySlug(slug: string): Promise<CharacterDetailResponse>;
  getProfile(slug: string): Promise<CharacterProfileResponse>;
  getHistory(slug: string): Promise<CharacterHistoryResponse>;
  /** What an item is, as its in-game tooltip shows it. */
  getItem(itemId: number): Promise<EquippedItem>;
}
