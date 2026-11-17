export const guildKeys = {
  all: ["guild"] as const,
  profile: () => [...guildKeys.all, "profile"] as const,
  roster: () => [...guildKeys.all, "roster"] as const,
  featured: () => [...guildKeys.all, "featured"] as const,
  chronicle: () => [...guildKeys.all, "chronicle"] as const,
  history: () => [...guildKeys.all, "history"] as const,
  party: () => [...guildKeys.all, "party"] as const,
  worldMap: () => [...guildKeys.all, "world-map"] as const,
};
