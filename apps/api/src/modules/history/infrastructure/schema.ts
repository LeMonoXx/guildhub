import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const guildCheck = pgTable(
  "guild_check",
  {
    guildSlug: text("guild_slug").notNull(),
    locale: text("locale").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    achievementPoints: integer("achievement_points").notNull(),
    members: jsonb("members").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.guildSlug, table.locale, table.recordedAt],
    }),
  ],
);
