import {
  contentLocaleOf,
  defaultContentLocale,
  itemQualitySchema,
} from "@guildhub/contracts";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../../../platform/db/client.js";
import type { HistoryStore } from "../application/ports.js";
import type { GuildCheck, MemberState } from "../domain/guild-check.js";
import { guildCheck } from "./schema.js";

export const membersSchema = z.array(
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
    recentAchievements: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          iconUrl: z.string().optional(),
          at: z.string(),
        }),
      )
      .optional(),
    questsCompleted: z.number().optional(),
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
) satisfies z.ZodType<MemberState[]>;

type Row = typeof guildCheck.$inferSelect;

function toCheck(row: Row): GuildCheck[] {
  const members = membersSchema.safeParse(row.members);
  if (!members.success) return [];
  return [
    {
      day: row.day,
      locale: contentLocaleOf(row.locale),
      recordedAt: row.recordedAt,
      checkedAt: row.checkedAt,
      achievementPoints: row.achievementPoints,
      members: members.data,
    },
  ];
}

export function makeDrizzleHistoryStore(database: Database): HistoryStore {
  return {
    latest: async (guild, locale) => {
      const [row] = await database.db
        .select()
        .from(guildCheck)
        .where(
          and(
            eq(guildCheck.guildSlug, guild.slug),
            eq(guildCheck.locale, locale),
          ),
        )
        .orderBy(desc(guildCheck.recordedAt))
        .limit(1);
      return row === undefined ? undefined : toCheck(row)[0];
    },
    append: async (guild, check) => {
      await database.db
        .insert(guildCheck)
        .values({
          guildSlug: guild.slug,
          locale: check.locale ?? defaultContentLocale,
          recordedAt: check.recordedAt,
          checkedAt: check.checkedAt,
          day: check.day,
          achievementPoints: check.achievementPoints,
          members: check.members,
        })
        .onConflictDoNothing();
    },
    confirm: async (guild, check, checkedAt) => {
      await database.db
        .update(guildCheck)
        .set({ checkedAt })
        .where(
          and(
            eq(guildCheck.guildSlug, guild.slug),
            eq(guildCheck.locale, check.locale ?? defaultContentLocale),
            eq(guildCheck.recordedAt, check.recordedAt),
          ),
        );
    },
    since: async (guild, fromDay, locale) => {
      const rows = await database.db
        .select()
        .from(guildCheck)
        .where(
          and(
            eq(guildCheck.guildSlug, guild.slug),
            gte(guildCheck.checkedAt, new Date(`${fromDay}T00:00:00.000Z`)),
            inArray(guildCheck.locale, [locale, defaultContentLocale]),
          ),
        )
        .orderBy(asc(guildCheck.recordedAt));
      const firstInLocale = rows.find(
        (row) => row.locale === locale,
      )?.recordedAt;
      return rows
        .filter(
          (row) =>
            row.locale === locale ||
            firstInLocale === undefined ||
            row.recordedAt < firstInLocale,
        )
        .flatMap(toCheck);
    },
    firstDay: async (guild) => {
      const [row] = await database.db
        .select({ day: guildCheck.day })
        .from(guildCheck)
        .where(eq(guildCheck.guildSlug, guild.slug))
        .orderBy(asc(guildCheck.recordedAt))
        .limit(1);
      return row?.day;
    },
  };
}
