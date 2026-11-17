import { z } from "zod";
import { characterSlugSchema } from "./guild.js";

export const partyRoleSchema = z.enum(["tank", "healer", "damage"]);

export const dungeonKeySchema = z.enum([
  "ragefireChasm",
  "wailingCaverns",
  "deadmines",
  "shadowfangKeep",
  "blackfathomDeeps",
  "stockade",
  "gnomeregan",
  "razorfenKraul",
  "scarletMonastery",
  "razorfenDowns",
  "uldaman",
  "zulFarrak",
  "maraudon",
  "sunkenTemple",
  "blackrockDepths",
  "blackrockSpire",
  "direMaul",
  "scholomance",
  "stratholme",
]);

/** A spot inside a zone, both axes 0..1 from the zone map's top left. */
const zonePointSchema = z.object({
  areaId: z.number().int().positive(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const partyMemberSchema = z.object({
  slug: characterSlugSchema,
  name: z.string().min(1),
  surname: z.string().min(1),
  classId: z.string().min(1),
  level: z.number().int().positive(),
  roles: z.array(partyRoleSchema).min(1),
  /** False when the character's armory profile is not public; its quests are unknown. */
  published: z.boolean(),
  lastLoginAt: z.iso.datetime().optional(),
  avatarUrl: z.string().min(1).optional(),
  /** The area most of this member's open quests are in. */
  focus: z
    .object({
      area: z.string().min(1),
      areaId: z.number().int().positive().optional(),
    })
    .optional(),
});

export const partyQuestSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  area: z.string().min(1).optional(),
  areaId: z.number().int().positive().optional(),
  minLevel: z.number().int().nonnegative().optional(),
  members: z.array(characterSlugSchema).min(1),
});

export const partyAreaSchema = z.object({
  area: z.string().min(1),
  areaId: z.number().int().positive().optional(),
  members: z.array(
    z.object({
      slug: characterSlugSchema,
      quests: z.number().int().positive(),
    }),
  ),
});

export const partyDungeonSchema = z.object({
  key: dungeonKeySchema,
  minLevel: z.number().int().positive(),
  maxLevel: z.number().int().positive(),
  entrance: zonePointSchema,
  /** The instance's own areas; quests and members there stand at the entrance. */
  areaIds: z.array(z.number().int().positive()),
  /** Every member whose level fits, closest to the dungeon's level first. */
  members: z.array(characterSlugSchema),
  /** A suggested group of up to five, with one tank and one healer when the guild has them. */
  group: z.array(
    z.object({ slug: characterSlugSchema, role: partyRoleSchema }),
  ),
  missing: z.array(partyRoleSchema),
  /** Open quests that send someone into this dungeon. */
  quests: z.array(z.number().int().positive()),
  /** The last boss: its model is baked under `bosses/v1/{displayId}`; no level means a skull. */
  boss: z.object({
    displayId: z.number().int().positive(),
    level: z.number().int().positive().optional(),
  }),
});

export const guildPartyResponseSchema = z.object({
  coverage: z.object({
    members: z.number().int().nonnegative(),
    profiles: z.number().int().nonnegative(),
  }),
  members: z.array(partyMemberSchema),
  /** Quests at least two members have open at the same time, most shared first. */
  quests: z.array(partyQuestSchema),
  /** Where the guild's open quests are, busiest first. */
  areas: z.array(partyAreaSchema),
  dungeons: z.array(partyDungeonSchema),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});

export type PartyRole = z.infer<typeof partyRoleSchema>;
export type DungeonKey = z.infer<typeof dungeonKeySchema>;
export type PartyMember = z.infer<typeof partyMemberSchema>;
export type PartyQuest = z.infer<typeof partyQuestSchema>;
export type PartyArea = z.infer<typeof partyAreaSchema>;
export type PartyDungeon = z.infer<typeof partyDungeonSchema>;
export type GuildPartyResponse = z.infer<typeof guildPartyResponseSchema>;
