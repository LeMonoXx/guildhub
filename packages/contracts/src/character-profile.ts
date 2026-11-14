import { z } from "zod";
import { characterSlugSchema } from "./guild.js";

export const itemQualitySchema = z.enum([
  "POOR",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "ARTIFACT",
  "HEIRLOOM",
]);

const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/);

export const itemStatSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  equipBonus: z.boolean(),
  color: colorSchema.optional(),
});

export const itemWeaponSchema = z.object({
  damage: z.string().min(1),
  damageClass: z.string().optional(),
  minDamage: z.number(),
  maxDamage: z.number(),
  speed: z.string().min(1).optional(),
  speedSeconds: z.number(),
  dps: z.string().min(1).optional(),
  dpsValue: z.number(),
});

export const equippedItemSchema = z.object({
  slot: z.string().min(1),
  slotName: z.string().min(1),
  itemId: z.number().int().positive(),
  name: z.string().min(1),
  quality: itemQualitySchema,
  qualityName: z.string().min(1),
  iconUrl: z.string().min(1).optional(),
  itemLevel: z.number().int().nonnegative().optional(),
  requiredLevel: z.number().int().nonnegative().optional(),
  binding: z.string().optional(),
  itemClass: z.string().optional(),
  itemSubclass: z.string().optional(),
  inventoryType: z.string().optional(),
  armor: z.string().optional(),
  shieldBlock: z.string().optional(),
  weapon: itemWeaponSchema.optional(),
  stats: z.array(itemStatSchema),
  enchantments: z.array(z.string().min(1)),
  durability: z
    .object({
      current: z.number().int().nonnegative(),
      max: z.number().int().nonnegative(),
    })
    .optional(),
  sellPriceCopper: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive(),
});

const baseSecondarySchema = z.object({
  base: z.number(),
  effective: z.number(),
});

export const characterStatisticsSchema = z.object({
  health: z.number(),
  power: z.number(),
  powerType: z.string().optional(),
  primary: z.array(
    z.object({ type: z.string().min(1) }).extend(baseSecondarySchema.shape),
  ),
  armor: baseSecondarySchema.optional(),
  defense: baseSecondarySchema.optional(),
  resistances: z.array(
    z.object({ school: z.string().min(1) }).extend(baseSecondarySchema.shape),
  ),
  melee: z.object({
    attackPower: z.number(),
    crit: z.number(),
    hit: z.number(),
    mainHand: z
      .object({
        min: z.number(),
        max: z.number(),
        speed: z.number(),
        dps: z.number(),
      })
      .optional(),
    offHand: z
      .object({
        min: z.number(),
        max: z.number(),
        speed: z.number(),
        dps: z.number(),
      })
      .optional(),
  }),
  ranged: z.object({
    attackPower: z.number(),
    crit: z.number(),
    hit: z.number(),
    min: z.number(),
    max: z.number(),
  }),
  spell: z.object({
    power: z.number(),
    healing: z.number(),
    crit: z.number(),
    hit: z.number(),
    penetration: z.number(),
    manaRegen: z.number(),
    manaRegenCombat: z.number(),
  }),
  defenses: z.object({
    dodge: z.number(),
    parry: z.number(),
    block: z.number(),
  }),
  movementSpeed: z.number().optional(),
});

export const talentSchema = z.object({
  name: z.string().min(1),
  rank: z.number().int().nonnegative(),
  description: z.string().optional(),
  castTime: z.string().optional(),
  spellId: z.number().int().positive().optional(),
});

export const specializationSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  spentPoints: z.number().int().nonnegative(),
  talents: z.array(talentSchema),
});

export const talentNodeSchema = z.object({
  id: z.number().int().positive(),
  talentId: z.number().int().positive(),
  name: z.string().min(1),
  /** Grid position, both counted from 1. */
  row: z.number().int().positive(),
  column: z.number().int().positive(),
  rank: z.number().int().nonnegative(),
  maxRank: z.number().int().positive(),
  spellId: z.number().int().positive().optional(),
  iconUrl: z.string().min(1).optional(),
  castTime: z.string().optional(),
  /** What the talent does at the learned rank, or at rank 1 while unlearned. */
  description: z.string().optional(),
  /** What the next rank would do; absent at the top rank. */
  nextDescription: z.string().optional(),
  /** Nodes that must be maxed out first. */
  requires: z.array(z.number().int().positive()),
});

export const talentTreeSchema = z.object({
  specId: z.number().int().positive(),
  name: z.string().min(1),
  iconUrl: z.string().min(1).optional(),
  spentPoints: z.number().int().nonnegative(),
  rows: z.number().int().positive(),
  columns: z.number().int().positive(),
  nodes: z.array(talentNodeSchema),
});

export const professionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  kind: z.enum(["primary", "secondary"]),
  skill: z.number().int().nonnegative(),
  maxSkill: z.number().int().nonnegative(),
  recipes: z.array(z.string().min(1)),
  /** Ids of the known recipes; absent in profiles fetched before ids were kept. */
  recipeIds: z.array(z.number().int().positive()).optional(),
});

export const reputationSchema = z.object({
  factionId: z.number().int().positive(),
  faction: z.string().min(1),
  standing: z.string().min(1),
  tier: z.number().int().nonnegative(),
  value: z.number().int(),
  max: z.number().int().nonnegative(),
});

/** What an achievement asks for, as the game's achievement tooltip shows it. */
export const achievementDetailsSchema = z.object({
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  reward: z.string().min(1).optional(),
  criteria: z.array(z.string().min(1)).optional(),
});

export const achievementRefSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  iconUrl: z.string().min(1).optional(),
  details: achievementDetailsSchema.optional(),
});

export const achievementEventSchema = achievementRefSchema.extend({
  at: z.iso.datetime(),
});

export const statisticGroupSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  entries: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number(),
      detail: z.string().optional(),
      at: z.iso.datetime().optional(),
    }),
  ),
});

export const characterProfileSchema = z.object({
  characterId: z.string().min(1),
  slug: characterSlugSchema,
  status: z.enum(["available", "unavailable"]),
  summary: z
    .object({
      level: z.number().int().positive(),
      experience: z.number().int().nonnegative().optional(),
      gender: z.string().optional(),
      faction: z.string().optional(),
      race: z.string().optional(),
      className: z.string().optional(),
      guild: z.string().optional(),
      lastLoginAt: z.iso.datetime().optional(),
      averageItemLevel: z.number().nonnegative().optional(),
      equippedItemLevel: z.number().nonnegative().optional(),
      achievementPoints: z.number().int().nonnegative(),
      activeTitle: z.string().optional(),
      ruleset: z.string().optional(),
    })
    .optional(),
  statistics: characterStatisticsSchema.optional(),
  equipment: z.array(equippedItemSchema),
  specializations: z.array(specializationSchema),
  /** The class's full talent trees with what this character learned; absent until fetched. */
  talentTrees: z.array(talentTreeSchema).optional(),
  professions: z.array(professionSchema),
  reputations: z.array(reputationSchema),
  titles: z.array(z.string().min(1)),
  pvp: z
    .object({
      honorableKills: z.number().int().nonnegative(),
      rank: z.number().int().nonnegative(),
    })
    .optional(),
  achievements: z.object({
    total: z.number().int().nonnegative(),
    points: z.number().int().nonnegative(),
    recent: z.array(achievementEventSchema),
    categories: z.array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().nonnegative(),
        points: z.number().int().nonnegative(),
      }),
    ),
    inProgress: z.array(achievementRefSchema),
  }),
  statisticGroups: z.array(statisticGroupSchema),
  collections: z.object({
    mounts: z.array(z.string().min(1)),
    pets: z.array(
      z.object({
        name: z.string().min(1),
        level: z.number().int().nonnegative(),
        quality: itemQualitySchema.optional(),
      }),
    ),
    toys: z.array(z.string().min(1)),
    heirlooms: z.array(z.string().min(1)),
  }),
  hunterPets: z.array(
    z.object({
      name: z.string().min(1),
      level: z.number().int().nonnegative(),
      creature: z.string().optional(),
      active: z.boolean(),
    }),
  ),
  quests: z.object({
    inProgress: z.array(z.string().min(1)),
    completedCount: z.number().int().nonnegative(),
    recentCompleted: z.array(z.string().min(1)),
  }),
  avatarUrl: z.string().min(1).optional(),
});

export const characterProfileResponseSchema = characterProfileSchema.extend({
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export type ItemQuality = z.infer<typeof itemQualitySchema>;
export type ItemStat = z.infer<typeof itemStatSchema>;
export type ItemWeapon = z.infer<typeof itemWeaponSchema>;
export type EquippedItem = z.infer<typeof equippedItemSchema>;
export type CharacterStatistics = z.infer<typeof characterStatisticsSchema>;
export type Talent = z.infer<typeof talentSchema>;
export type Specialization = z.infer<typeof specializationSchema>;
export type TalentNode = z.infer<typeof talentNodeSchema>;
export type TalentTree = z.infer<typeof talentTreeSchema>;
export type Profession = z.infer<typeof professionSchema>;
export type Reputation = z.infer<typeof reputationSchema>;
export type AchievementEvent = z.infer<typeof achievementEventSchema>;
export type AchievementRef = z.infer<typeof achievementRefSchema>;
export type AchievementDetails = z.infer<typeof achievementDetailsSchema>;
export type StatisticGroup = z.infer<typeof statisticGroupSchema>;
export type CharacterProfile = z.infer<typeof characterProfileSchema>;
export type CharacterProfileResponse = z.infer<
  typeof characterProfileResponseSchema
>;
