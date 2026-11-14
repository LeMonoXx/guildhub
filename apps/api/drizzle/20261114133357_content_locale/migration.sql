ALTER TABLE "character_profile" ADD COLUMN "locale" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "guild_day" ADD COLUMN "locale" text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "character_profile" DROP CONSTRAINT "character_profile_pkey";--> statement-breakpoint
ALTER TABLE "character_profile" ADD PRIMARY KEY ("character_id","locale");--> statement-breakpoint
ALTER TABLE "guild_day" DROP CONSTRAINT "guild_day_pkey";--> statement-breakpoint
ALTER TABLE "guild_day" ADD PRIMARY KEY ("guild_slug","day","locale");--> statement-breakpoint
UPDATE "recipe_catalog" SET "id" = 'recipes-en' WHERE "id" = 'current';