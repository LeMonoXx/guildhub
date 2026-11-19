import { z } from "zod";
import { itemQualitySchema } from "./character-profile.js";
import { characterSlugSchema } from "./guild.js";

/** A calendar day in the guild's time zone, `YYYY-MM-DD`. */
export const historyDaySchema = z.iso.date();

/** The hourly check that saw it. */
const historyAtSchema = z.iso.datetime();

const memberRefSchema = z.object({
  slug: characterSlugSchema,
  name: z.string().min(1),
  surname: z.string().min(1),
  classId: z.string().min(1),
  avatarUrl: z.string().min(1).optional(),
});

const eventSchema = memberRefSchema.extend({
  day: historyDaySchema,
  at: historyAtSchema,
});

const change = <T extends z.ZodType>(value: T) =>
  z.object({ from: value, to: value });

export const historyEventSchema = z.discriminatedUnion("kind", [
  eventSchema.extend({ kind: z.literal("joined") }),
  eventSchema.extend({ kind: z.literal("left") }),
  eventSchema.extend({
    kind: z.literal("level"),
    ...change(z.number().int().positive()).shape,
  }),
  eventSchema.extend({
    kind: z.literal("rank"),
    ...change(z.number().int().nonnegative()).shape,
  }),
  eventSchema.extend({
    kind: z.literal("item"),
    slot: z.string().min(1),
    itemId: z.number().int().positive(),
    item: z.string().min(1),
    quality: itemQualitySchema,
    itemLevel: z.number().int().nonnegative().optional(),
    iconUrl: z.string().min(1).optional(),
  }),
  eventSchema.extend({
    kind: z.literal("profession"),
    profession: z.string().min(1),
    /** Battle.net's skill line; absent in checks recorded before it was kept. */
    professionId: z.number().int().positive().optional(),
    ...change(z.number().int().nonnegative()).shape,
    maxSkill: z.number().int().nonnegative().optional(),
  }),
  eventSchema.extend({
    kind: z.literal("reputation"),
    faction: z.string().min(1),
    standing: z.string().min(1),
    tier: z.number().int().nonnegative(),
  }),
  eventSchema.extend({
    kind: z.literal("achievements"),
    count: z.number().int().positive(),
    points: z.number().int().nonnegative(),
  }),
  /** One achievement; `at` is when it was earned, not when a check saw it. */
  eventSchema.extend({
    kind: z.literal("achievement"),
    achievementId: z.number().int().positive(),
    achievement: z.string().min(1),
    iconUrl: z.string().min(1).optional(),
  }),
  eventSchema.extend({
    kind: z.literal("mount"),
    mount: z.string().min(1),
  }),
  eventSchema.extend({
    kind: z.literal("quests"),
    ...change(z.number().int().nonnegative()).shape,
  }),
]);

export const guildHistoryPointSchema = z.object({
  day: historyDaySchema,
  at: historyAtSchema,
  members: z.number().int().nonnegative(),
  averageLevel: z.number().nonnegative(),
  averageItemLevel: z.number().nonnegative().optional(),
  /** The members' achievements combined. */
  achievements: z.number().int().nonnegative(),
});

export const guildHistoryResponseSchema = z.object({
  /** The first day the guild was recorded; history starts there. */
  since: historyDaySchema.optional(),
  /** When the latest hourly check ran. */
  checkedAt: z.iso.datetime().optional(),
  series: z.array(guildHistoryPointSchema),
  events: z.array(historyEventSchema),
});

export const characterHistoryPointSchema = z.object({
  day: historyDaySchema,
  at: historyAtSchema,
  level: z.number().int().positive(),
  itemLevel: z.number().nonnegative().optional(),
  achievements: z.number().int().nonnegative(),
  quests: z.number().int().nonnegative().optional(),
});

export const characterHistoryResponseSchema = z.object({
  since: historyDaySchema.optional(),
  checkedAt: z.iso.datetime().optional(),
  series: z.array(characterHistoryPointSchema),
  events: z.array(historyEventSchema),
});

export type HistoryEvent = z.infer<typeof historyEventSchema>;
export type HistoryEventKind = HistoryEvent["kind"];
export type GuildHistoryPoint = z.infer<typeof guildHistoryPointSchema>;
export type GuildHistoryResponse = z.infer<typeof guildHistoryResponseSchema>;
export type CharacterHistoryPoint = z.infer<typeof characterHistoryPointSchema>;
export type CharacterHistoryResponse = z.infer<
  typeof characterHistoryResponseSchema
>;
