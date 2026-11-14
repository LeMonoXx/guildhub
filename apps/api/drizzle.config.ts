import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/platform/db/schema.ts",
    "./src/modules/guild/infrastructure/schema.ts",
    "./src/modules/character/infrastructure/schema.ts",
    "./src/modules/history/infrastructure/schema.ts",
    "./src/modules/crafting/infrastructure/schema.ts",
  ],
  out: "./drizzle",
});
