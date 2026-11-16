import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
} from "../../guild/index.js";
import {
  findRosterMember,
  type CharacterNotFound as NotFound,
} from "./find-roster-member.js";
import type { CharacterRender } from "./get-character-render.js";
import type { CharacterCache, CharacterMediaGateway } from "./ports.js";

type MediaNotFound = ReturnType<typeof appError<"media.not_found">>;

export const makeGetCharacterAvatar =
  (deps: {
    getRoster: GetGuildRoster;
    cache: CharacterCache;
    media: CharacterMediaGateway;
  }) =>
  async (query: {
    guild: GuildRef;
    slug: string;
  }): Promise<
    Result<CharacterRender, GuildSourceError | NotFound | MediaNotFound>
  > => {
    const found = await findRosterMember(deps.getRoster, query);
    if (!found.ok) return found;
    const snapshot = await deps.cache.latest(found.value.member.characterId);
    const url = snapshot?.facts.avatarAssetUrl;
    if (url === undefined) return err(appError("media.not_found"));
    const fetched = await deps.media.fetchRender(url);
    if (fetched === undefined) return err(appError("media.not_found"));
    return ok(fetched);
  };

export const makeGetItemIcon =
  (deps: { media: CharacterMediaGateway }) =>
  async (iconId: number): Promise<Result<CharacterRender, MediaNotFound>> => {
    if (!Number.isSafeInteger(iconId) || iconId <= 0) {
      return err(appError("media.not_found"));
    }
    const fetched = await deps.media.fetchIcon(iconId);
    if (fetched === undefined) return err(appError("media.not_found"));
    return ok(fetched);
  };

export type GetCharacterAvatar = ReturnType<typeof makeGetCharacterAvatar>;
export type GetItemIcon = ReturnType<typeof makeGetItemIcon>;
