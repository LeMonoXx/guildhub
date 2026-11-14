import type { BlizzardApiClient } from "@blizzard-api/client";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type {
  CharacterRef,
  CharacterSource,
  CharacterSourceError,
} from "../application/ports.js";
import type { CharacterFacts } from "../domain/look.js";
import { forCharacter, sendBattleNet } from "./battle-net-request.js";
import { mapCharacterFacts } from "./map-character-facts.js";
import {
  characterAppearanceEndpoint,
  characterEquipmentEndpoint,
  characterMediaEndpoint,
} from "./wow-forever-character.js";

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
    await Promise.all([
      sendBattleNet(
        client,
        characterAppearanceEndpoint(character.name, character.surname),
      ),
      sendBattleNet(
        client,
        characterEquipmentEndpoint(character.name, character.surname),
      ),
      sendBattleNet(
        client,
        characterMediaEndpoint(character.name, character.surname),
      ),
    ])
  ).map((result) => forCharacter(result, character.characterId)) as [
    Result<unknown, CharacterSourceError>,
    Result<unknown, CharacterSourceError>,
    Result<unknown, CharacterSourceError>,
  ];
  if (!appearance.ok && !equipment.ok && !media.ok) return appearance;
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
