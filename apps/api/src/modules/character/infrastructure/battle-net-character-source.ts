import type { BlizzardApiClient } from "@blizzard-api/client";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type {
  CharacterRef,
  CharacterSource,
  CharacterSourceError,
} from "../application/ports.js";
import type { CharacterFacts } from "../domain/look.js";
import {
  forCharacter,
  sendCharacterRequestPatiently,
} from "./battle-net-request.js";
import { mapCharacterFacts } from "./map-character-facts.js";
import {
  characterAppearanceEndpoint,
  characterEquipmentEndpoint,
  characterMediaEndpoint,
} from "./wow-forever-character.js";

const FACT_ATTEMPTS = 3;

export function makeBattleNetCharacterSource(
  client: BlizzardApiClient,
): CharacterSource {
  return {
    fetchFacts: (character) => fetchFacts(client, character),
  };
}

async function fetchFacts(
  client: BlizzardApiClient,
  character: CharacterRef,
): Promise<Result<CharacterFacts, CharacterSourceError>> {
  const [appearance, equipment, media] = (
    await Promise.all(
      [
        characterAppearanceEndpoint(character.name, character.surname),
        characterEquipmentEndpoint(character.name, character.surname),
        characterMediaEndpoint(character.name, character.surname),
      ].map((resource) =>
        sendCharacterRequestPatiently(client, resource, {
          attempts: FACT_ATTEMPTS,
        }),
      ),
    )
  ).map((result) => forCharacter(result, character.characterId)) as [
    Result<unknown, CharacterSourceError>,
    Result<unknown, CharacterSourceError>,
    Result<unknown, CharacterSourceError>,
  ];
  if (!appearance.ok && !equipment.ok && !media.ok) return appearance;
  // An unanswered document would bake a bare default figure over the last
  // good look; failing keeps that one instead.
  for (const result of [appearance, equipment, media]) {
    if (!result.ok && result.error.code !== "character.not_found")
      return result;
  }
  return ok(
    mapCharacterFacts({
      appearance: appearance.ok ? appearance.value : {},
      equipment: equipment.ok ? equipment.value : {},
      media: media.ok ? media.value : {},
      fallbackRaceId: Number(character.raceId),
      fallbackClassId: Number(character.classId),
    }),
  );
}
