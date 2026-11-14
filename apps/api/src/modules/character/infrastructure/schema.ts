import {
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const characterCache = pgTable("character_cache", {
  characterId: text("character_id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  surname: text("surname").notNull(),
  status: text("status").notNull().default("found"),
  facts: jsonb("facts").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});

export const characterProfileCache = pgTable(
  "character_profile",
  {
    characterId: text("character_id").notNull(),
    locale: text("locale").notNull().default("en"),
    slug: text("slug").notNull(),
    profile: jsonb("profile").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.characterId, table.locale] })],
);
