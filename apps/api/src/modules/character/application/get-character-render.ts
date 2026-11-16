import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
} from "../../guild/index.js";
import {
  findRosterMember,
  type CharacterNotFound,
} from "./find-roster-member.js";
import type { CharacterCache, CharacterMediaGateway } from "./ports.js";

export type CharacterRender = {
  readonly body: Uint8Array;
  readonly contentType: string;
};

export type GetCharacterRenderResult = Result<
  CharacterRender,
  GuildSourceError | CharacterNotFound
>;

export const makeGetCharacterRender =
  (deps: {
    getRoster: GetGuildRoster;
    cache: CharacterCache;
    media: CharacterMediaGateway;
  }) =>
  async (query: {
    guild: GuildRef;
    slug: string;
  }): Promise<GetCharacterRenderResult> => {
    const found = await findRosterMember(deps.getRoster, query);
    if (!found.ok) return found;
    const snapshot = await deps.cache.latest(found.value.member.characterId);
    const url = snapshot?.facts.renderAssetUrl;
    if (url === undefined) return err(appError("character.not_found"));
    const fetched = await deps.media.fetchRender(url);
    if (fetched === undefined) return err(appError("character.not_found"));
    return ok(fetched);
  };

export type GetCharacterRender = ReturnType<typeof makeGetCharacterRender>;
