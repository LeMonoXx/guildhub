import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname);
const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return extname(path) === ".ts" || extname(path) === ".tsx" ? [path] : [];
  });
const sources = sourceFiles(root)
  .filter((path) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"))
  .map((path) => ({
    name: relative(root, path).replaceAll("\\", "/"),
    source: readFileSync(path, "utf8"),
  }));

describe("character cinematic architecture", () => {
  test("keeps Three.js imports inside adapters", () => {
    for (const { name, source } of sources) {
      if (name.startsWith("adapters/")) continue;
      expect(source, name).not.toMatch(
        /(?:from|import\s*\()\s*["']three(?:\/[^"']*)?["']/,
      );
    }
  });

  test("has one browser animation clock in the React host", () => {
    for (const { name, source } of sources) {
      expect(source, name).not.toContain("THREE.Clock");
      if (name === "ui/CharacterCinematic.tsx") continue;
      expect(source, name).not.toContain("requestAnimationFrame");
      expect(source, name).not.toContain("cancelAnimationFrame");
    }
  });

  test("uses the character widget public boundary", () => {
    for (const { name, source } of sources)
      expect(source, name).not.toMatch(/character-model\/(?:lib|model|ui)\//);
  });
});
