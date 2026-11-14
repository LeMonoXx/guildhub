CREATE TABLE "character_cache" (
	"character_id" text PRIMARY KEY,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"surname" text NOT NULL,
	"facts" jsonb NOT NULL,
	"look_hash" text,
	"model_status" text,
	"client_build" text,
	"fetched_at" timestamp with time zone NOT NULL
);
