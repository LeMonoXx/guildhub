CREATE TABLE "recipe_catalog" (
	"id" text PRIMARY KEY,
	"recipes" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
