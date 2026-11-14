import { z } from "zod";

export const guildFactionSchema = z.enum(["ALLIANCE", "HORDE", "NEUTRAL"]);

export const guildProfileResponseSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  faction: guildFactionSchema,
  achievementPoints: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime().optional(),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const characterSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase character slug");

export const guildRosterMemberSchema = z.object({
  characterId: z.string().min(1),
  name: z.string().min(1),
  surname: z.string().min(1),
  level: z.number().int().positive(),
  rankId: z.number().int().nonnegative(),
  classId: z.string().min(1),
  raceId: z.string().min(1),
  slug: characterSlugSchema,
  renderUrl: z.string().min(1).optional(),
  avatarUrl: z.string().min(1).optional(),
});

export const guildRosterResponseSchema = z.object({
  members: z.array(guildRosterMemberSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const characterPresentationSchema = z.object({
  slug: characterSlugSchema,
  pose: z.string().min(1),
  accent: z.string().min(1),
  lookManifest: z.string().min(1),
  /** Gear that needs extra room in a lineup, like a shield on the back. */
  carries: z.array(z.enum(["shield", "two-hand"])).optional(),
});

export const featuredMemberSchema = guildRosterMemberSchema.extend(
  characterPresentationSchema.shape,
);

export const featuredMembersResponseSchema = z.object({
  members: z.array(featuredMemberSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const characterModelStatusSchema = z.enum([
  "ready",
  "pending",
  "unavailable",
]);

export const characterModelSchema = z.object({
  status: characterModelStatusSchema,
  manifestUrl: z.string().min(1).optional(),
  renderUrl: z.string().min(1).optional(),
  lookHash: z.string().min(1),
  clientBuild: z.string().min(1),
});

export const characterDetailResponseSchema = featuredMemberSchema.extend({
  /** False when Battle.net does not publish this character's profile. */
  published: z.boolean(),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
  model: characterModelSchema,
});

export type GuildFaction = z.infer<typeof guildFactionSchema>;
export type GuildProfileResponse = z.infer<typeof guildProfileResponseSchema>;
export type GuildRosterMember = z.infer<typeof guildRosterMemberSchema>;
export type GuildRosterResponse = z.infer<typeof guildRosterResponseSchema>;
export type CharacterSlug = z.infer<typeof characterSlugSchema>;
export type CharacterPresentation = z.infer<typeof characterPresentationSchema>;
export type FeaturedMember = z.infer<typeof featuredMemberSchema>;
export type FeaturedMembersResponse = z.infer<
  typeof featuredMembersResponseSchema
>;
export type CharacterDetailResponse = z.infer<
  typeof characterDetailResponseSchema
>;
export type CharacterModelStatus = z.infer<typeof characterModelStatusSchema>;
export type CharacterModel = z.infer<typeof characterModelSchema>;
