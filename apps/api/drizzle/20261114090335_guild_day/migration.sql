CREATE TABLE "guild_day" (
	"guild_slug" text,
	"day" date,
	"achievement_points" integer NOT NULL,
	"members" jsonb NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	CONSTRAINT "guild_day_pkey" PRIMARY KEY("guild_slug","day")
);
