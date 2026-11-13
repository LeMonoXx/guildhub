import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/platform/db/schema.ts",
    "./src/modules/guild/infrastructure/schema.ts",
  ],
  out: "./drizzle",
});
