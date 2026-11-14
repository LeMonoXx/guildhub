import {
  contentLocaleOf,
  defaultContentLocale,
  itemQualitySchema,
} from "@guildhub/contracts";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../platform/db/client.js";
import type { HistoryStore } from "../application/ports.js";
import type { MemberDay } from "../domain/guild-day.js";
import { guildDay } from "./schema.js";

const membersSchema = z.array(
  z.object({
    characterId: z.string(),
    slug: z.string(),
    name: z.string(),
    surname: z.string(),
    classId: z.string(),
    level: z.number(),
    rankId: z.number(),
    published: z.boolean(),
    itemLevel: z.number().optional(),
    achievementPoints: z.number(),
    achievements: z.number(),
    equipment: z.array(
      z.object({
        slot: z.string(),
        itemId: z.number(),
        name: z.string(),
        quality: itemQualitySchema,
        itemLevel: z.number().optional(),
        iconUrl: z.string().optional(),
      }),
    ),
    professions: z.array(
      z.object({
        name: z.string(),
        skill: z.number(),
        maxSkill: z.number().optional(),
      }),
    ),
    reputations: z.array(
      z.object({
        factionId: z.number(),
        faction: z.string(),
        standing: z.string(),
        tier: z.number(),
      }),
    ),
    mounts: z.array(z.string()),
  }),
) satisfies z.ZodType<MemberDay[]>;

export function makeDrizzleHistoryStore(database: Database): HistoryStore {
  return {
    save: async (guild, day) => {
      const row = {
        guildSlug: guild.slug,
        day: day.day,
        locale: day.locale ?? defaultContentLocale,
        achievementPoints: day.achievementPoints,
        members: day.members,
        recordedAt: day.recordedAt,
      };
      await database.db
        .insert(guildDay)
        .values(row)
        .onConflictDoUpdate({
          target: [guildDay.guildSlug, guildDay.day, guildDay.locale],
          set: row,
        });
    },
    since: async (guild, fromDay, locale) => {
      const rows = await database.db
        .select()
        .from(guildDay)
        .where(
          and(
            eq(guildDay.guildSlug, guild.slug),
            gte(guildDay.day, fromDay),
            inArray(guildDay.locale, [locale, defaultContentLocale]),
          ),
        )
        .orderBy(asc(guildDay.day));
      const preferred = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        if (row.locale === locale || !preferred.has(row.day))
          preferred.set(row.day, row);
      }
      return [...preferred.values()].flatMap((row) => {
        const members = membersSchema.safeParse(row.members);
        if (!members.success) return [];
        return [
          {
            day: row.day,
            locale: contentLocaleOf(row.locale),
            recordedAt: row.recordedAt,
            achievementPoints: row.achievementPoints,
            members: members.data,
          },
        ];
      });
    },
    firstDay: async (guild) => {
      const [row] = await database.db
        .select({ day: guildDay.day })
        .from(guildDay)
        .where(eq(guildDay.guildSlug, guild.slug))
        .orderBy(asc(guildDay.day))
        .limit(1);
      return row?.day;
    },
  };
}
