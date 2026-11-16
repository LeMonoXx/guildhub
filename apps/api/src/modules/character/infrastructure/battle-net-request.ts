import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import {
  sendBattleNet,
  sendBattleNetPatiently,
  type BattleNetResource,
  type PatientRequestOptions,
} from "../../../platform/blizzard/request.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, type Result } from "../../../platform/kernel/result.js";
import type { CharacterSourceError } from "../application/ports.js";

/** A character document Battle.net does not have is a missing character. */
export const sendCharacterRequest = (
  client: BlizzardApiClient,
  resource: BattleNetResource,
  locale?: ContentLocale,
): Promise<Result<unknown, CharacterSourceError>> =>
  sendBattleNet(client, resource, {
    notFound: "character.not_found",
    ...(locale === undefined ? {} : { locale }),
  });

export const sendCharacterRequestPatiently = (
  client: BlizzardApiClient,
  resource: BattleNetResource,
  options: Omit<PatientRequestOptions<"character.not_found">, "notFound"> = {},
): Promise<Result<unknown, CharacterSourceError>> =>
  sendBattleNetPatiently(client, resource, {
    ...options,
    notFound: "character.not_found",
  });

/**
 * Forever can answer a name with a different character than the roster
 * meant. A body that names another character id is treated as missing.
 */
export function describesCharacter(
  body: unknown,
  characterId: string,
): boolean {
  const record = asRecord(body);
  const id = asRecord(record.character).id ?? record.id;
  return typeof id !== "number" || String(id) === characterId;
}

export function forCharacter(
  result: Result<unknown, CharacterSourceError>,
  characterId: string,
): Result<unknown, CharacterSourceError> {
  if (!result.ok || describesCharacter(result.value, characterId)) {
    return result;
  }
  return err(appError("character.not_found"));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
