import { createHttpCharacterSource } from "./http-source";
import { characterQueries as createCharacterQueries } from "./queries";

export const characterSource = createHttpCharacterSource();
export const characterQueries = createCharacterQueries(characterSource);
