import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** The whole recipe catalog of one game build, rebuilt by the worker. */
export const recipeCatalog = pgTable("recipe_catalog", {
  id: text("id").primaryKey(),
  recipes: jsonb("recipes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
