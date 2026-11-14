import { z } from "zod";
import { itemQualitySchema } from "./character-profile.js";

const idSchema = z.number().int().positive();

export const recipeItemRefSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  quality: itemQualitySchema,
  iconUrl: z.string().min(1).optional(),
});

/**
 * How a recipe is learned. Trainers teach every recipe that has no recipe
 * item; the others come from a recipe item, whose own source (vendor, drop,
 * quest) the game data does not tell.
 */
export const recipeSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("trainer") }),
  z.object({
    kind: z.literal("recipe-item"),
    item: recipeItemRefSchema,
    requiredSkill: z.number().int().nonnegative().optional(),
  }),
]);

export const recipeStatSchema = z.object({
  /** Stable stat key such as "STAMINA". */
  type: z.string().min(1),
  name: z.string().min(1),
  value: z.number(),
});

export const craftedItemSchema = recipeItemRefSchema.extend({
  itemLevel: z.number().int().nonnegative().optional(),
  slot: z.string().min(1).optional(),
  stats: z.array(recipeStatSchema),
  /** "Use:" and "Equip:" texts, e.g. what a potion does. */
  effects: z.array(z.string().min(1)),
});

export const recipeReagentSchema = z.object({
  itemId: idSchema,
  name: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const recipeSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  professionId: idSchema,
  profession: z.string().min(1),
  category: z.string().min(1),
  iconUrl: z.string().min(1).optional(),
  craftedItem: craftedItemSchema.optional(),
  craftedQuantity: z.number().int().positive(),
  reagents: z.array(recipeReagentSchema),
  source: recipeSourceSchema,
});

export const recipeCrafterSchema = z.object({
  characterId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  classId: z.string().min(1),
  skill: z.number().int().nonnegative().optional(),
});

export const recipeResultSchema = recipeSchema.extend({
  crafters: z.array(recipeCrafterSchema),
});

export const recipeSearchQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  profession: z.coerce.number().int().positive().optional(),
  stat: z.string().trim().min(1).max(40).optional(),
  known: z
    .enum(["1", "true"])
    .transform(() => true)
    .optional(),
  offset: z.coerce.number().int().nonnegative().max(5000).default(0),
});

export const recipeSearchResponseSchema = z.object({
  recipes: z.array(recipeResultSchema),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  professions: z.array(
    z.object({
      id: idSchema,
      name: z.string().min(1),
      recipes: z.number().int().nonnegative(),
    }),
  ),
  stats: z.array(
    z.object({ type: z.string().min(1), name: z.string().min(1) }),
  ),
  /** False until the worker has built the recipe catalog for the first time. */
  catalogReady: z.boolean(),
  updatedAt: z.iso.datetime().optional(),
});

export type RecipeItemRef = z.infer<typeof recipeItemRefSchema>;
export type RecipeSource = z.infer<typeof recipeSourceSchema>;
export type RecipeStat = z.infer<typeof recipeStatSchema>;
export type CraftedItem = z.infer<typeof craftedItemSchema>;
export type RecipeReagent = z.infer<typeof recipeReagentSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeCrafter = z.infer<typeof recipeCrafterSchema>;
export type RecipeResult = z.infer<typeof recipeResultSchema>;
export type RecipeSearchQuery = z.infer<typeof recipeSearchQuerySchema>;
export type RecipeSearchResponse = z.infer<typeof recipeSearchResponseSchema>;
