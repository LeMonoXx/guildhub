CREATE TABLE "guild_check" (
	"guild_slug" text,
	"locale" text,
	"recorded_at" timestamp with time zone,
	"checked_at" timestamp with time zone NOT NULL,
	"day" date NOT NULL,
	"achievement_points" integer NOT NULL,
	"members" jsonb NOT NULL,
	CONSTRAINT "guild_check_pkey" PRIMARY KEY("guild_slug","locale","recorded_at")
);
--> statement-breakpoint
INSERT INTO "guild_check" ("guild_slug", "locale", "recorded_at", "checked_at", "day", "achievement_points", "members")
SELECT "guild_slug", COALESCE("locale", 'en'), "recorded_at", "recorded_at", "day", "achievement_points", "members" FROM "guild_day";--> statement-breakpoint
DROP TABLE "guild_day";