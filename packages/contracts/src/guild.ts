import { z } from "zod";

export const guildFactionSchema = z.enum(["ALLIANCE", "HORDE", "NEUTRAL"]);

export const guildProfileResponseSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  faction: guildFactionSchema,
  achievementPoints: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const guildRosterMemberSchema = z.object({
  characterId: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  level: z.number().int().positive(),
  rankId: z.number().int().nonnegative(),
  classId: z.string().min(1),
  raceId: z.string().min(1),
});

export const guildRosterResponseSchema = z.object({
  members: z.array(guildRosterMemberSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export type GuildFaction = z.infer<typeof guildFactionSchema>;
export type GuildProfileResponse = z.infer<typeof guildProfileResponseSchema>;
export type GuildRosterMember = z.infer<typeof guildRosterMemberSchema>;
export type GuildRosterResponse = z.infer<typeof guildRosterResponseSchema>;
