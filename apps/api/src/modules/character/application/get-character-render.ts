import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
} from "../../guild/index.js";
import type { CharacterCache, CharacterMediaGateway } from "./ports.js";

export type CharacterRender = {
  readonly body: Uint8Array;
  readonly contentType: string;
};

export type GetCharacterRenderResult = Result<
  CharacterRender,
  GuildSourceError | ReturnType<typeof appError<"character.not_found">>
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
    const roster = await deps.getRoster(query.guild);
    if (!roster.ok) return roster;
    const member = roster.value.data.find((item) => item.slug === query.slug);
    if (member === undefined) return err(appError("character.not_found"));
    const snapshot = await deps.cache.latest(member.characterId);
    const url = snapshot?.facts.renderAssetUrl;
    if (url === undefined) return err(appError("character.not_found"));
    const fetched = await deps.media.fetchRender(url);
    if (fetched === undefined) return err(appError("character.not_found"));
    return ok(fetched);
  };

export type GetCharacterRender = ReturnType<typeof makeGetCharacterRender>;
