import { ok, type Result } from "../../../platform/kernel/result.js";
import type {
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
  GuildView,
} from "../../guild/index.js";
import type { CharacterView } from "./character-view.js";
import {
  findRosterMember,
  type CharacterNotFound,
} from "./find-roster-member.js";
import {
  loadCharacterView,
  type CharacterViewDeps,
} from "./load-character-view.js";
export type GetCharacterResult = Result<
  GuildView<CharacterView>,
  GuildSourceError | CharacterNotFound
>;

export const makeGetCharacter =
  (deps: CharacterViewDeps & { getRoster: GetGuildRoster }) =>
  async (query: {
    guild: GuildRef;
    slug: string;
  }): Promise<GetCharacterResult> => {
    const found = await findRosterMember(deps.getRoster, query);
    if (!found.ok) return found;
    const view = await loadCharacterView(deps, found.value.member, {
      enqueue: true,
    });
    return ok({
      data: view,
      fetchedAt: found.value.fetchedAt,
      stale: found.value.stale,
    });
  };

export type GetCharacter = ReturnType<typeof makeGetCharacter>;
