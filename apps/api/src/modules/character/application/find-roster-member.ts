import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
  RosterMember,
} from "../../guild/index.js";

export type CharacterNotFound = ReturnType<
  typeof appError<"character.not_found">
>;

export interface FoundMember {
  readonly member: RosterMember;
  readonly fetchedAt: Date;
  readonly stale: boolean;
}

/** The roster member a public character slug names. */
export async function findRosterMember(
  getRoster: GetGuildRoster,
  query: { readonly guild: GuildRef; readonly slug: string },
): Promise<Result<FoundMember, GuildSourceError | CharacterNotFound>> {
  const roster = await getRoster(query.guild);
  if (!roster.ok) return roster;
  const member = roster.value.data.find((item) => item.slug === query.slug);
  if (member === undefined) return err(appError("character.not_found"));
  return ok({
    member,
    fetchedAt: roster.value.fetchedAt,
    stale: roster.value.stale,
  });
}
