import { z } from "zod";
import { characterSlugSchema } from "./guild.js";

const memberRefSchema = z.object({
  slug: characterSlugSchema,
  name: z.string().min(1),
  surname: z.string().min(1),
  classId: z.string().min(1),
});

const countSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const guildDossierSchema = memberRefSchema.extend({
  characterId: z.string().min(1),
  status: z.enum(["available", "unavailable"]),
  level: z.number().int().positive(),
  averageItemLevel: z.number().nonnegative().optional(),
  lastLoginAt: z.iso.datetime().optional(),
  achievementPoints: z.number().int().nonnegative(),
  questsCompleted: z.number().int().nonnegative(),
  honorableKills: z.number().int().nonnegative(),
  mounts: z.number().int().nonnegative(),
  specialization: z.string().optional(),
  professions: z.array(
    z.object({
      name: z.string().min(1),
      skill: z.number().int().nonnegative(),
      maxSkill: z.number().int().nonnegative(),
    }),
  ),
  avatarUrl: z.string().min(1).optional(),
});

export const guildChronicleResponseSchema = z.object({
  createdAt: z.iso.datetime().optional(),
  coverage: z.object({
    members: z.number().int().nonnegative(),
    profiles: z.number().int().nonnegative(),
  }),
  totals: z.object({
    averageLevel: z.number().nonnegative(),
    maxLevel: z.number().int().nonnegative(),
    honorableKills: z.number().int().nonnegative(),
    questsCompleted: z.number().int().nonnegative(),
    achievements: z.number().int().nonnegative(),
    mounts: z.number().int().nonnegative(),
    pets: z.number().int().nonnegative(),
    recipes: z.number().int().nonnegative(),
    bossKills: z.number().int().nonnegative(),
    exaltedReputations: z.number().int().nonnegative(),
  }),
  classes: z.array(countSchema),
  races: z.array(countSchema),
  ranks: z.array(countSchema),
  levels: z.array(
    z.object({
      from: z.number().int().positive(),
      to: z.number().int().positive(),
      count: z.number().int().nonnegative(),
    }),
  ),
  professions: z.array(
    z.object({
      name: z.string().min(1),
      crafters: z.array(
        memberRefSchema.extend({
          skill: z.number().int().nonnegative(),
          maxSkill: z.number().int().nonnegative(),
        }),
      ),
    }),
  ),
  bestiary: z.array(
    z.object({
      boss: z.string().min(1),
      place: z.string().optional(),
      kills: z.number().int().nonnegative(),
      slayers: z.array(memberRefSchema),
    }),
  ),
  hallOfFame: z.array(
    memberRefSchema.extend({
      category: z.enum([
        "level",
        "itemLevel",
        "quests",
        "honorableKills",
        "achievements",
        "mounts",
        "recipes",
        "reputation",
      ]),
      value: z.number().nonnegative(),
    }),
  ),
  dossiers: z.array(guildDossierSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export type GuildDossier = z.infer<typeof guildDossierSchema>;
export type GuildChronicleResponse = z.infer<
  typeof guildChronicleResponseSchema
>;
export type HallOfFameCategory =
  GuildChronicleResponse["hallOfFame"][number]["category"];
