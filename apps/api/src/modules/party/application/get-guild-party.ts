import type { ContentLocale } from "@guildhub/contracts";
import { ok, type Result } from "../../../platform/kernel/result.js";
import type { LoadMemberProfiles } from "../../character/index.js";
import type {
  GetGuild,
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
  GuildView,
} from "../../guild/index.js";
import { composeParty, type Party } from "../domain/party.js";

export const makeGetGuildParty =
  (deps: {
    getGuild: GetGuild;
    getRoster: GetGuildRoster;
    loadProfiles: LoadMemberProfiles;
  }) =>
  async (
    guild: GuildRef,
    locale: ContentLocale,
  ): Promise<Result<GuildView<Party>, GuildSourceError>> => {
    const [profile, roster] = await Promise.all([
      deps.getGuild(guild),
      deps.getRoster(guild),
    ]);
    if (!roster.ok) return roster;
    const profiles = await deps.loadProfiles(roster.value.data, locale);
    return ok({
      data: composeParty({
        ...(profile.ok ? { faction: profile.value.data.faction } : {}),
        entries: profiles.map(({ member, profile: snapshot }) => ({
          member,
          available: snapshot.status === "available",
          profile: snapshot.data,
        })),
      }),
      fetchedAt: roster.value.fetchedAt,
      stale: roster.value.stale,
    });
  };

export type GetGuildParty = ReturnType<typeof makeGetGuildParty>;
