import type { InstanceConfig } from "@guildhub/contracts";
import {
  makeLoadMemberProfiles,
  publicAvatarUrl,
  publicIconUrl,
} from "./modules/character/index.js";
import {
  makeBattleNetCharacterProfileSource,
  makeDrizzleCharacterProfileCache,
} from "./modules/character/infrastructure/index.js";
import { makeGetGuild, makeGetGuildRoster } from "./modules/guild/index.js";
import {
  makeBattleNetGuildSource,
  makeDrizzleGuildCache,
} from "./modules/guild/infrastructure/index.js";
import { makeDrizzleHistoryStore } from "./modules/history/infrastructure/index.js";
import { createBattleNetClient } from "./platform/blizzard/client.js";
import type { Env } from "./platform/config/env.js";
import type { Database } from "./platform/db/client.js";
import { systemClock } from "./platform/kernel/clock.js";

/** The guild, profile and history wiring the API and the worker share. */
export async function composeGuild(deps: {
  env: Env;
  instance: InstanceConfig;
  database: Database;
}) {
  const { env, instance, database } = deps;
  const battleNet = await createBattleNetClient({
    key: env.BATTLENET_CLIENT_ID,
    secret: env.BATTLENET_CLIENT_SECRET,
    origin: instance.region,
    apiBaseUrl: env.BATTLENET_API_BASE_URL,
  });
  const guildDeps = {
    source: makeBattleNetGuildSource(battleNet),
    cache: makeDrizzleGuildCache(database),
    clock: systemClock,
    maxAgeMs: env.GUILD_CACHE_TTL_SECONDS * 1000,
  };
  const profileDeps = {
    source: makeBattleNetCharacterProfileSource(battleNet, {
      icon: publicIconUrl,
      avatar: publicAvatarUrl,
    }),
    cache: makeDrizzleCharacterProfileCache(database),
    clock: systemClock,
    maxAgeMs: env.CHARACTER_CACHE_TTL_SECONDS * 1000,
  };
  return {
    battleNet,
    guild: { slug: instance.guild.slug },
    getGuild: makeGetGuild(guildDeps),
    getGuildRoster: makeGetGuildRoster(guildDeps),
    profileDeps,
    loadProfiles: makeLoadMemberProfiles(profileDeps),
    history: {
      store: makeDrizzleHistoryStore(database),
      clock: systemClock,
      timeZone: env.HISTORY_TIME_ZONE,
    },
  };
}
