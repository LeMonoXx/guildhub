import type { GuildProfileResponse } from "@guildhub/contracts";
import { GuildTitle } from "./guild-title";

/** The guild's name as the opening title over the stage. The line follows on its own. */
export function TitleCard({ guild }: { readonly guild: GuildProfileResponse }) {
  return <GuildTitle guild={guild} showLine={false} />;
}
