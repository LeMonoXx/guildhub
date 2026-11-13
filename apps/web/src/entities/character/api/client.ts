import { createFixtureCharacterSource } from "./fixture-source";
import { characterQueries as createCharacterQueries } from "./queries";

export const characterSource = createFixtureCharacterSource();
export const characterQueries = createCharacterQueries(characterSource);
