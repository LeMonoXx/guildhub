import { fixtureCharacterBySlug } from "./fixtures";
import { CharacterNotFoundError, type CharacterDataSource } from "./source";

export const createFixtureCharacterSource = (): CharacterDataSource => ({
  getBySlug: (slug) => {
    const character = fixtureCharacterBySlug(slug);
    if (!character) return Promise.reject(new CharacterNotFoundError(slug));
    return Promise.resolve(character);
  },
});
