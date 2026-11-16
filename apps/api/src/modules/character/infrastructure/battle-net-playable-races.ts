import type { BlizzardApiClient } from "@blizzard-api/client";
import { wowForever } from "@blizzard-api/wow-forever";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type { CharacterSourceError } from "../application/ports.js";
import { sendBattleNetPatiently } from "./battle-net-request.js";

/** Every race the game lets a player create, as the game data lists them. */
export async function fetchPlayableRaceIds(
  client: BlizzardApiClient,
): Promise<Result<number[], CharacterSourceError>> {
  const index = await sendBattleNetPatiently(
    client,
    wowForever.playableRaceIndex(),
  );
  if (!index.ok) return index;
  const races = (index.value as { races?: unknown }).races;
  const ids = Array.isArray(races)
    ? races.flatMap((race) => {
        const id = (race as { id?: unknown } | null)?.id;
        return typeof id === "number" && id > 0 ? [id] : [];
      })
    : [];
  return ids.length > 0
    ? ok([...new Set(ids)].sort((left, right) => left - right))
    : err(appError("upstream.unavailable", { detail: "no playable races" }));
}
