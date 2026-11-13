import type { Clock } from "../../../platform/kernel/clock.js";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import type { GuildRef } from "../domain/guild-ref.js";
import {
  isFresh,
  type GuildCache,
  type GuildSource,
  type GuildSourceError,
  type GuildView,
} from "./ports.js";

export type GetGuildResult = Result<GuildView<GuildProfile>, GuildSourceError>;

export const makeGetGuild =
  (deps: {
    source: GuildSource;
    cache: GuildCache;
    clock: Clock;
    maxAgeMs: number;
  }) =>
  async (guild: GuildRef): Promise<GetGuildResult> => {
    const cached = await deps.cache.latestProfile(guild);
    const now = deps.clock.now();
    if (cached !== undefined && isFresh(cached.fetchedAt, now, deps.maxAgeMs)) {
      return ok({
        data: cached.payload,
        fetchedAt: cached.fetchedAt,
        stale: false,
      });
    }

    const fetched = await deps.source.fetchProfile(guild);
    if (fetched.ok) {
      const snapshot = {
        guild,
        fetchedAt: now,
        payload: fetched.value,
      };
      await deps.cache.saveProfile(snapshot);
      return ok({
        data: fetched.value,
        fetchedAt: now,
        stale: false,
      });
    }

    if (cached !== undefined) {
      return ok({
        data: cached.payload,
        fetchedAt: cached.fetchedAt,
        stale: true,
      });
    }

    return fetched;
  };

export type GetGuild = ReturnType<typeof makeGetGuild>;
