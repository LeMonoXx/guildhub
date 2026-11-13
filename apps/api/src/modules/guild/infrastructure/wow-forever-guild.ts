import { wowForever } from "@blizzard-api/wow-forever";

export function guildEndpoint(nameSlug: string) {
  return wowForever.guild(nameSlug);
}

export function guildRosterEndpoint(nameSlug: string) {
  return wowForever.guildRoster(nameSlug);
}
