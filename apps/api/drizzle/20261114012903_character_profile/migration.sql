CREATE TABLE "character_profile" (
	"character_id" text PRIMARY KEY,
	"slug" text NOT NULL,
	"profile" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_cache" ADD COLUMN "status" text DEFAULT 'found' NOT NULL;