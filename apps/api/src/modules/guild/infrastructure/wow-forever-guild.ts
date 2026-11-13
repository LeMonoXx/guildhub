import type { BlizzardNamespaces, Resource } from "@blizzard-api/core";
import { wowBasePath } from "@blizzard-api/core";
import { wowForever } from "@blizzard-api/wow-forever";

const wowGuildBasePath = `${wowBasePath}/guild`;
const profileForeverNamespace = "profile-forever" as BlizzardNamespaces;

// @blizzard-api/wow-forever 0.3.x added wowForever.guild / guildRoster, but that
// line is younger than minimumReleaseAge. Use the package helper when present and
// otherwise the same Resource shape published in 0.3.x.

type GuildResource = Resource<unknown>;

function packageResource(
  name: "guild" | "guildRoster",
  nameSlug: string,
): GuildResource | undefined {
  const candidate = (wowForever as Record<string, unknown>)[name];
  if (typeof candidate !== "function") return undefined;
  return (candidate as (slug: string) => GuildResource)(nameSlug);
}

export function guildEndpoint(nameSlug: string): GuildResource {
  return (
    packageResource("guild", nameSlug) ?? {
      namespace: profileForeverNamespace,
      path: `${wowGuildBasePath}/${encodeURIComponent(nameSlug)}`,
    }
  );
}

export function guildRosterEndpoint(nameSlug: string): GuildResource {
  return (
    packageResource("guildRoster", nameSlug) ?? {
      namespace: profileForeverNamespace,
      path: `${wowGuildBasePath}/${encodeURIComponent(nameSlug)}/roster`,
    }
  );
}
