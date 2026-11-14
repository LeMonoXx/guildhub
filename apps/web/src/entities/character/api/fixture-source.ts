import { fixtureCharacterBySlug } from "./fixtures";
import { fixtureCharacterHistory } from "./history-fixtures";
import { fixtureCharacterProfile } from "./profile-fixtures";
import { CharacterNotFoundError, type CharacterDataSource } from "./source";

export const createFixtureCharacterSource = (): CharacterDataSource => ({
  getBySlug: (slug) => {
    const character = fixtureCharacterBySlug(slug);
    if (!character) return Promise.reject(new CharacterNotFoundError(slug));
    return Promise.resolve(character);
  },
  getProfile: (slug) => {
    const profile = fixtureCharacterProfile(slug);
    if (!profile) return Promise.reject(new CharacterNotFoundError(slug));
    return Promise.resolve(profile);
  },
  getHistory: (slug) => Promise.resolve(fixtureCharacterHistory(slug)),
});
