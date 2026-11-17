import { ok, type Result } from "../../../platform/kernel/result.js";
import { rankFeaturedCandidates } from "../domain/featured-members.js";
import type { GuildRef } from "../domain/guild-ref.js";
import type { RosterMember } from "../domain/roster-member.js";
import type { GetGuildRoster } from "./get-guild-roster.js";
import type { GuildSourceError, GuildView } from "./ports.js";

export type GetFeaturedMembersResult = Result<
  GuildView<readonly RosterMember[]>,
  GuildSourceError
>;

/** Returns every member in featuring order; presenters apply the limit. */
export const makeGetFeaturedMembers =
  (deps: {
    getRoster: GetGuildRoster;
    /** Instance list. Missing or ambiguous names are skipped. */
    preferred?: readonly string[];
  }) =>
  async (guild: GuildRef): Promise<GetFeaturedMembersResult> => {
    const roster = await deps.getRoster(guild);
    if (!roster.ok) return roster;
    return ok({
      data: rankFeaturedCandidates(roster.value.data, deps.preferred ?? []),
      fetchedAt: roster.value.fetchedAt,
      stale: roster.value.stale,
    });
  };

export type GetFeaturedMembers = ReturnType<typeof makeGetFeaturedMembers>;
