import type { BlizzardApiClient } from "@blizzard-api/client";
import { defaultContentLocale, type ContentLocale } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type { CharacterSourceError } from "../application/ports.js";

export type BattleNetResource = Parameters<BlizzardApiClient["sendRequest"]>[0];
type ClientLocaleOption = NonNullable<
  Parameters<BlizzardApiClient["sendRequest"]>[1]
>["locale"];

type BattleNetLocale = NonNullable<ClientLocaleOption>;

const battleNetLocales: Readonly<Record<ContentLocale, BattleNetLocale>> = {
  en: "en_GB",
  de: "de_DE",
};

/** The key Battle.net uses for a language, also inside multi-language names. */
export const battleNetLocaleOf = (locale: ContentLocale): BattleNetLocale =>
  battleNetLocales[locale];

export async function sendBattleNet(
  client: BlizzardApiClient,
  resource: BattleNetResource,
  locale: ContentLocale = defaultContentLocale,
): Promise<Result<unknown, CharacterSourceError>> {
  try {
    if (client.defaults.token === undefined) {
      await client.refreshAccessToken();
    }
    const body = await client.sendRequest(resource, {
      locale: battleNetLocaleOf(locale),
    });
    if (body === undefined) return err(appError("upstream.unavailable"));
    return ok(body);
  } catch (error) {
    return err(mapUpstreamError(error));
  }
}

const MAX_RETRY_WAIT_MS = 5000;

/**
 * For static game data fetched in bulk: throttled or failed answers are
 * tried again after the wait Battle.net asks for, a few times at most.
 */
export async function sendBattleNetPatiently(
  client: BlizzardApiClient,
  resource: BattleNetResource,
  {
    locale = defaultContentLocale,
    attempts = 4,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  }: {
    readonly locale?: ContentLocale;
    readonly attempts?: number;
    readonly sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<Result<unknown, CharacterSourceError>> {
  let result = await sendBattleNet(client, resource, locale);
  for (
    let attempt = 1;
    attempt < attempts &&
    !result.ok &&
    result.error.code === "upstream.unavailable";
    attempt += 1
  ) {
    const asked = (result.error.retryAfterSeconds ?? 0) * 1000;
    await sleep(
      Math.min(MAX_RETRY_WAIT_MS, Math.max(asked, 400 * 2 ** attempt)),
    );
    result = await sendBattleNet(client, resource, locale);
  }
  return result;
}

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

export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await run(items[index] as T);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function mapUpstreamError(error: unknown): CharacterSourceError {
  const status = httpStatus(error);
  if (status === 404) return appError("character.not_found");
  if (status === 429) {
    return appError("upstream.unavailable", {
      retryAfterSeconds: retryAfterSeconds(error) ?? 1,
    });
  }
  return appError("upstream.unavailable");
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

function retryAfterSeconds(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return undefined;
  }
  const response = (error as { response?: Response }).response;
  const header = response?.headers.get("Retry-After");
  if (header === null || header === undefined) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
