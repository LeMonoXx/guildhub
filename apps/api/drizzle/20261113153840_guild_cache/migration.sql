CREATE TABLE "guild_cache" (
	"guild_slug" text PRIMARY KEY,
	"profile" jsonb,
	"roster" jsonb,
	"profile_fetched_at" timestamp with time zone,
	"roster_fetched_at" timestamp with time zone
);
