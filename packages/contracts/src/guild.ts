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
  slug: characterSlugSchema.optional(),
});

export const guildRosterResponseSchema = z.object({
  members: z.array(guildRosterMemberSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const animationOverlaySchema = z.object({
  id: z.string().min(1),
  animationGroup: z.string().min(1),
  mask: z.literal("upper-body"),
  weight: z.number().min(0).max(1),
  fadeMs: z.number().nonnegative(),
});

export const characterPresentationSchema = z.object({
  slug: characterSlugSchema,
  pose: z.string().min(1),
  accent: z.string().min(1),
  lookManifest: z.string().min(1),
  cinematicScene: z.string().min(1),
  overlay: animationOverlaySchema.optional(),
});

export const featuredMemberSchema = guildRosterMemberSchema.extend(
  characterPresentationSchema.shape,
);

export const featuredMembersResponseSchema = z.object({
  members: z.array(featuredMemberSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export const characterDetailResponseSchema = featuredMemberSchema.extend({
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export type GuildFaction = z.infer<typeof guildFactionSchema>;
export type GuildProfileResponse = z.infer<typeof guildProfileResponseSchema>;
export type GuildRosterMember = z.infer<typeof guildRosterMemberSchema>;
export type GuildRosterResponse = z.infer<typeof guildRosterResponseSchema>;
export type CharacterSlug = z.infer<typeof characterSlugSchema>;
export type AnimationOverlay = z.infer<typeof animationOverlaySchema>;
export type CharacterPresentation = z.infer<typeof characterPresentationSchema>;
export type FeaturedMember = z.infer<typeof featuredMemberSchema>;
export type FeaturedMembersResponse = z.infer<
  typeof featuredMembersResponseSchema
>;
export type CharacterDetailResponse = z.infer<
  typeof characterDetailResponseSchema
>;
