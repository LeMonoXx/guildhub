import type { AppError } from "../../../platform/kernel/app-error.js";
import type { Result } from "../../../platform/kernel/result.js";
import type { GuildProfile } from "../domain/guild-profile.js";
import type { GuildRef } from "../domain/guild-ref.js";
import type { RosterMember } from "../domain/roster-member.js";
import type { GuildSnapshot } from "../domain/snapshot.js";

export type GuildNotFound = AppError<"guild.not_found">;
export type UpstreamUnavailable = AppError<"upstream.unavailable">;
export type GuildSourceError = GuildNotFound | UpstreamUnavailable;

export interface GuildSource {
  fetchProfile(
    guild: GuildRef,
  ): Promise<Result<GuildProfile, GuildSourceError>>;
  fetchRoster(
    guild: GuildRef,
  ): Promise<Result<readonly RosterMember[], GuildSourceError>>;
}

export interface GuildCache {
  latestProfile(
    guild: GuildRef,
  ): Promise<GuildSnapshot<GuildProfile> | undefined>;
  latestRoster(
    guild: GuildRef,
  ): Promise<GuildSnapshot<readonly RosterMember[]> | undefined>;
  saveProfile(snapshot: GuildSnapshot<GuildProfile>): Promise<void>;
  saveRoster(snapshot: GuildSnapshot<readonly RosterMember[]>): Promise<void>;
}

export interface GuildView<T> {
  readonly data: T;
  readonly fetchedAt: Date;
  readonly stale: boolean;
}

export function isFresh(fetchedAt: Date, now: Date, maxAgeMs: number): boolean {
  return now.getTime() - fetchedAt.getTime() < maxAgeMs;
}
