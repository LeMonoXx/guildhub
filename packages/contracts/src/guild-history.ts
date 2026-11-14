import { z } from "zod";
import { itemQualitySchema } from "./character-profile.js";
import { characterSlugSchema } from "./guild.js";

/** A calendar day in the guild's time zone, `YYYY-MM-DD`. */
export const historyDaySchema = z.iso.date();

const memberRefSchema = z.object({
  slug: characterSlugSchema,
  name: z.string().min(1),
  surname: z.string().min(1),
  classId: z.string().min(1),
  avatarUrl: z.string().min(1).optional(),
});

const change = <T extends z.ZodType>(value: T) =>
  z.object({ from: value, to: value });

export const historyEventSchema = z.discriminatedUnion("kind", [
  memberRefSchema.extend({ kind: z.literal("joined"), day: historyDaySchema }),
  memberRefSchema.extend({ kind: z.literal("left"), day: historyDaySchema }),
  memberRefSchema.extend({
    kind: z.literal("level"),
    day: historyDaySchema,
    ...change(z.number().int().positive()).shape,
  }),
  memberRefSchema.extend({
    kind: z.literal("rank"),
    day: historyDaySchema,
    ...change(z.number().int().nonnegative()).shape,
  }),
  memberRefSchema.extend({
    kind: z.literal("item"),
    day: historyDaySchema,
    slot: z.string().min(1),
    itemId: z.number().int().positive(),
    item: z.string().min(1),
    quality: itemQualitySchema,
    itemLevel: z.number().int().nonnegative().optional(),
    iconUrl: z.string().min(1).optional(),
  }),
  memberRefSchema.extend({
    kind: z.literal("profession"),
    day: historyDaySchema,
    profession: z.string().min(1),
    ...change(z.number().int().nonnegative()).shape,
    maxSkill: z.number().int().nonnegative().optional(),
  }),
  memberRefSchema.extend({
    kind: z.literal("reputation"),
    day: historyDaySchema,
    faction: z.string().min(1),
    standing: z.string().min(1),
    tier: z.number().int().nonnegative(),
  }),
  memberRefSchema.extend({
    kind: z.literal("achievements"),
    day: historyDaySchema,
    count: z.number().int().positive(),
    points: z.number().int().nonnegative(),
  }),
  memberRefSchema.extend({
    kind: z.literal("mount"),
    day: historyDaySchema,
    mount: z.string().min(1),
  }),
]);

export const guildHistoryPointSchema = z.object({
  day: historyDaySchema,
  members: z.number().int().nonnegative(),
  averageLevel: z.number().nonnegative(),
  averageItemLevel: z.number().nonnegative().optional(),
  /** The members' achievements combined. */
  achievements: z.number().int().nonnegative(),
});

export const guildHistoryResponseSchema = z.object({
  /** The first day the guild was recorded; history starts there. */
  since: historyDaySchema.optional(),
  series: z.array(guildHistoryPointSchema),
  events: z.array(historyEventSchema),
});

export const characterHistoryPointSchema = z.object({
  day: historyDaySchema,
  level: z.number().int().positive(),
  itemLevel: z.number().nonnegative().optional(),
  achievements: z.number().int().nonnegative(),
});

export const characterHistoryResponseSchema = z.object({
  since: historyDaySchema.optional(),
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
