export const guildKeys = {
  all: ["guild"] as const,
  profile: () => [...guildKeys.all, "profile"] as const,
  roster: () => [...guildKeys.all, "roster"] as const,
  featured: () => [...guildKeys.all, "featured"] as const,
};
