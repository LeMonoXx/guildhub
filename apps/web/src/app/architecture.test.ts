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

  test("character page stands the member look, not the rogue proof", () => {
    const backdrop = production.find(
      (file) =>
        file.name === "widgets/character-cinematic/ui/character-backdrop.tsx",
    );
    expect(backdrop?.source).toContain("buildCharacterIdleScene");
    expect(backdrop?.source).not.toContain("rogue-proof");
    expect(backdrop?.source).not.toContain("cinematicScene");
  });

  test("pages reach the cinematic stage only through its lazy wrapper", () => {
    for (const { name, source } of production) {
      if (!name.startsWith("pages/")) continue;
      expect(source, name).not.toMatch(/\bCharacterCinematic\b/);
      expect(source, name).not.toMatch(/\blazy\(/);
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

  test("entity clients talk HTTP, not fixtures", () => {
    const guild = production.find(
      (file) => file.name === "entities/guild/api/client.ts",
    );
    const character = production.find(
      (file) => file.name === "entities/character/api/client.ts",
    );
    expect(guild?.source).toContain("createHttpGuildSource");
    expect(guild?.source).not.toContain("createFixtureGuildSource");
    expect(character?.source).toContain("createHttpCharacterSource");
    expect(character?.source).not.toContain("createFixtureCharacterSource");
  });

  test("shared i18n owns both locales", () => {
    const i18n = production.find(
      (file) => file.name === "shared/i18n/messages.ts",
    );
    expect(i18n?.source).toContain("locales/de.json");
    expect(i18n?.source).toContain("locales/en.json");
  });
});
