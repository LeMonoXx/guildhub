import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return extname(path) === ".ts" || extname(path) === ".tsx" ? [path] : [];
  });

const production = sourceFiles(root)
  .filter((path) => !path.includes(".test."))
  .map((path) => ({
    name: relative(root, path).replaceAll("\\", "/"),
    source: readFileSync(path, "utf8"),
  }));

describe("portal architecture", () => {
  test("pages never import fixture files or Three.js", () => {
    for (const { name, source } of production) {
      if (!name.startsWith("pages/")) continue;
      expect(source, name).not.toMatch(/\/fixtures(?:["']|$)/);
      expect(source, name).not.toMatch(
        /(?:from|import\s*\()\s*["']three(?:\/[^"']*)?["']/,
      );
    }
  });

  test("member routes stay free of the cinematic widget", () => {
    const members = production.filter((file) =>
      file.name.startsWith("pages/members/"),
    );
    expect(members.length).toBeGreaterThan(0);
    for (const { name, source } of members)
      expect(source, name).not.toContain("character-cinematic");
  });

  test("shared i18n owns both locales", () => {
    const i18n = production.find(
      (file) => file.name === "shared/i18n/messages.ts",
    );
    expect(i18n?.source).toContain("locales/de.json");
    expect(i18n?.source).toContain("locales/en.json");
  });
});
