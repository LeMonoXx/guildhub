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
import { composeChronicle, type Chronicle } from "../domain/chronicle.js";

export const makeGetGuildChronicle =
  (deps: {
    getGuild: GetGuild;
    getRoster: GetGuildRoster;
    loadProfiles: LoadMemberProfiles;
  }) =>
  async (
    guild: GuildRef,
    locale: ContentLocale,
  ): Promise<Result<GuildView<Chronicle>, GuildSourceError>> => {
    const [profile, roster] = await Promise.all([
      deps.getGuild(guild),
      deps.getRoster(guild),
    ]);
    if (!roster.ok) return roster;
    const profiles = await deps.loadProfiles(roster.value.data, locale);
    const createdAt = profile.ok ? profile.value.data.createdAt : undefined;
    return ok({
      data: composeChronicle({
        ...(createdAt === undefined ? {} : { createdAt }),
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

export type GetGuildChronicle = ReturnType<typeof makeGetGuildChronicle>;
