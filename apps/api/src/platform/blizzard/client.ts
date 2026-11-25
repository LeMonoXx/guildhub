import {
  createBlizzardApiClient,
  type BlizzardApiClient,
  type ClientOptions,
} from "@blizzard-api/client";
import type { Origins } from "@blizzard-api/core";

export interface BattleNetClientConfig {
  readonly key: string;
  readonly secret: string;
  readonly origin: Origins;
  readonly apiBaseUrl?: string;
}

export async function createBattleNetClient(
  config: BattleNetClientConfig,
): Promise<BlizzardApiClient> {
  const options: ClientOptions = {
    key: config.key,
    secret: config.secret,
    origin: config.origin,
    maxAttempts: 1,
    retryOnRateLimit: false,
  };
  if (config.apiBaseUrl !== undefined) {
    const rewrite = rewriteBattleNetRequest(config.apiBaseUrl);
    options.kyOptions = {
      fetch: (input, init) => {
        const request = new Request(input, init);
        return fetch(rewrite(request));
      },
    };
  }
  // Client credentials expire. The library refreshes the token before that,
  // and again after a failed refresh, so a long-lived process keeps reading.
  return createBlizzardApiClient(options, true);
}

export function rewriteBattleNetRequest(
  apiBaseUrl: string,
): (request: Request) => Request {
  const base = new URL(apiBaseUrl);
  return (request) => {
    const url = new URL(request.url);
    if (!isBattleNetHost(url.hostname)) return request;
    url.protocol = base.protocol;
    url.host = base.host;
    return new Request(url, request);
  };
}

function isBattleNetHost(hostname: string): boolean {
  return (
    hostname === "oauth.battle.net" ||
    hostname.endsWith(".battle.net") ||
    hostname.endsWith(".api.blizzard.com")
  );
}
