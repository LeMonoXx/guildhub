import {
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const guildDay = pgTable(
  "guild_day",
  {
    guildSlug: text("guild_slug").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    locale: text("locale").notNull().default("en"),
    achievementPoints: integer("achievement_points").notNull(),
    members: jsonb("members").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.guildSlug, table.day, table.locale] }),
  ],
);
