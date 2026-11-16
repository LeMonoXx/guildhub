import type { ContentLocale } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
  GuildView,
} from "../../guild/index.js";
import {
  findRosterMember,
  type CharacterNotFound,
} from "./find-roster-member.js";
import {
  loadMemberProfiles,
  type MemberProfile,
  type ProfileDeps,
} from "./load-member-profiles.js";

export type GetCharacterProfileResult = Result<
  GuildView<MemberProfile>,
  GuildSourceError | CharacterNotFound
>;

export const makeGetCharacterProfile =
  (deps: ProfileDeps & { getRoster: GetGuildRoster }) =>
  async (query: {
    guild: GuildRef;
    slug: string;
    locale: ContentLocale;
  }): Promise<GetCharacterProfileResult> => {
    const found = await findRosterMember(deps.getRoster, query);
    if (!found.ok) return found;
    const [profile] = await loadMemberProfiles(
      deps,
      [found.value.member],
      query.locale,
    );
    if (profile === undefined) return err(appError("character.not_found"));
    return ok({
      data: profile,
      fetchedAt: profile.profile.fetchedAt,
      stale: found.value.stale,
    });
  };

export type GetCharacterProfile = ReturnType<typeof makeGetCharacterProfile>;
