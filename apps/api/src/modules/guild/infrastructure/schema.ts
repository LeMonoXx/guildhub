import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const guildCache = pgTable("guild_cache", {
  guildSlug: text("guild_slug").primaryKey(),
  profile: jsonb("profile"),
  roster: jsonb("roster"),
  profileFetchedAt: timestamp("profile_fetched_at", { withTimezone: true }),
  rosterFetchedAt: timestamp("roster_fetched_at", { withTimezone: true }),
});
