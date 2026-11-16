import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import type { BattleNetResource } from "../../../platform/blizzard/request.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  CharacterRef,
  CharacterSourceError,
} from "../application/ports.js";
import {
  forCharacter,
  sendCharacterRequestPatiently,
} from "./battle-net-request.js";
import { characterProfileEndpoints } from "./wow-forever-character.js";

const REQUEST_CONCURRENCY = 6;
const PROFILE_ATTEMPTS = 3;

export type ProfileDocuments = Partial<
  Record<keyof ReturnType<typeof characterProfileEndpoints>, unknown>
>;

/** Every profile document of one character; missing documents stay absent. */
export async function fetchProfileDocuments(
  client: BlizzardApiClient,
  character: CharacterRef,
  locale: ContentLocale,
): Promise<Result<ProfileDocuments, CharacterSourceError>> {
  const endpoints = characterProfileEndpoints(
    character.name,
    character.surname,
  );
  const entries = Object.entries(endpoints) as [
    keyof typeof endpoints,
    BattleNetResource,
  ][];
  const results = await mapLimited(
    entries,
    REQUEST_CONCURRENCY,
    async ([key, resource]) =>
      [
        key,
        forCharacter(
          await sendCharacterRequestPatiently(client, resource, {
            locale,
            attempts: PROFILE_ATTEMPTS,
          }),
          character.characterId,
        ),
      ] as const,
  );
  const byKey = new Map(results);
  const summary = byKey.get("summary");
  if (summary === undefined) return err(appError("character.not_found"));
  if (!summary.ok) return summary;
  // A document that did not answer would read as "nothing there" and
  // overwrite the last good profile; failing keeps that one instead.
  for (const result of byKey.values()) {
    if (!result.ok && result.error.code !== "character.not_found")
      return result;
  }
  const documents: Record<string, unknown> = {};
  for (const [key, result] of byKey) {
    if (result.ok) documents[key] = result.value;
  }
  return ok(documents as ProfileDocuments);
}
