import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const contractsEntry = fileURLToPath(
  new URL("../../packages/contracts/src/index.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      "@guildhub/contracts": contractsEntry,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
