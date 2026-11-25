import type { BlizzardApiClient } from "@blizzard-api/client";
import {
  defaultContentLocale,
  type ContentLocale,
  type ProblemCode,
} from "@guildhub/contracts";
import { appError, type AppError } from "../kernel/app-error.js";
import { err, ok, type Result } from "../kernel/result.js";

export type BattleNetResource = Parameters<BlizzardApiClient["sendRequest"]>[0];
type ClientLocaleOption = NonNullable<
  Parameters<BlizzardApiClient["sendRequest"]>[1]
>["locale"];

type BattleNetLocale = NonNullable<ClientLocaleOption>;

/** A missing document answers with the caller's own not-found code. */
export type BattleNetError<NotFound extends ProblemCode> =
  AppError<NotFound> | AppError<"upstream.unavailable">;

export interface BattleNetRequestOptions<NotFound extends ProblemCode> {
  readonly notFound: NotFound;
  readonly locale?: ContentLocale;
}

export interface PatientRequestOptions<
  NotFound extends ProblemCode,
> extends BattleNetRequestOptions<NotFound> {
  readonly attempts?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const battleNetLocales: Readonly<Record<ContentLocale, BattleNetLocale>> = {
  en: "en_GB",
  de: "de_DE",
};

/** The key Battle.net uses for a language, also inside multi-language names. */
export const battleNetLocaleOf = (locale: ContentLocale): BattleNetLocale =>
  battleNetLocales[locale];

export async function sendBattleNet<NotFound extends ProblemCode>(
  client: BlizzardApiClient,
  resource: BattleNetResource,
  {
    notFound,
    locale = defaultContentLocale,
  }: BattleNetRequestOptions<NotFound>,
): Promise<Result<unknown, BattleNetError<NotFound>>> {
  try {
    if (client.defaults.token === undefined) {
      await client.refreshAccessToken();
    }
    return await readBattleNet(client, resource, locale);
  } catch (error) {
    if (httpStatus(error) !== 401)
      return err(mapUpstreamError(error, notFound));
    try {
      await client.refreshAccessToken();
      return await readBattleNet(client, resource, locale);
    } catch (retryError) {
      return err(mapUpstreamError(retryError, notFound));
    }
  }
}

async function readBattleNet(
  client: BlizzardApiClient,
  resource: BattleNetResource,
  locale: ContentLocale,
): Promise<Result<unknown, AppError<"upstream.unavailable">>> {
  const body = await client.sendRequest(resource, {
    locale: battleNetLocaleOf(locale),
  });
  if (body === undefined) return err(appError("upstream.unavailable"));
  return ok(body);
}

const MAX_RETRY_WAIT_MS = 5000;

/**
 * Throttled or failed answers are tried again after the wait Battle.net asks
 * for, a few times at most.
 */
export async function sendBattleNetPatiently<NotFound extends ProblemCode>(
  client: BlizzardApiClient,
  resource: BattleNetResource,
  {
    attempts = 4,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...request
  }: PatientRequestOptions<NotFound>,
): Promise<Result<unknown, BattleNetError<NotFound>>> {
  let result = await sendBattleNet(client, resource, request);
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
    result = await sendBattleNet(client, resource, request);
  }
  return result;
}

function mapUpstreamError<NotFound extends ProblemCode>(
  error: unknown,
  notFound: NotFound,
): BattleNetError<NotFound> {
  const status = httpStatus(error);
  if (status === 404) return appError(notFound);
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
