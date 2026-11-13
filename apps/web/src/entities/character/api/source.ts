import type { CharacterDetailResponse } from "@guildhub/contracts";

export class CharacterNotFoundError extends Error {
  readonly code = "character-not-found";

  constructor(slug: string) {
    super(`No character for slug "${slug}"`);
    this.name = "CharacterNotFoundError";
  }
}

export interface CharacterDataSource {
  getBySlug(slug: string): Promise<CharacterDetailResponse>;
}
