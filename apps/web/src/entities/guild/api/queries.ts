import type { GuildDataSource } from "./source";
import { guildKeys } from "./keys";

export const guildQueries = (source: GuildDataSource) => ({
  profile: () => ({
    queryKey: guildKeys.profile(),
    queryFn: () => source.getProfile(),
  }),
  roster: () => ({
    queryKey: guildKeys.roster(),
    queryFn: () => source.getRoster(),
  }),
  featured: () => ({
    queryKey: guildKeys.featured(),
    queryFn: () => source.getFeaturedMembers(),
  }),
});
