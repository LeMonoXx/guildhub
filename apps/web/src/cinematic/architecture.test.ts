import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const directory = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(directory)
  .filter((name) => extname(name) === ".ts" && !name.endsWith(".test.ts"))
  .map((name) => ({
    name,
    source: readFileSync(join(directory, name), "utf8"),
  }));

describe("cinematic architecture", () => {
  test("imports neither React nor Three.js", () => {
    for (const { name, source } of sources) {
      expect(source, name).not.toMatch(
        /(?:from|import\s*\()\s*["'](?:react|react-dom|three)(?:\/[^"']*)?["']/,
      );
    }
  });

  test("uses only the public contracts package API", () => {
    const contractImports = sources.flatMap(({ source }) =>
      [...source.matchAll(/from\s+["'](@guildhub\/contracts[^"']*)["']/g)].map(
        (match) => match[1],
      ),
    );
    expect(contractImports).toEqual([
      "@guildhub/contracts",
      "@guildhub/contracts",
    ]);
  });

  test("contains no browser globals", () => {
    for (const { name, source } of sources)
      expect(source, name).not.toMatch(
        /\b(?:window|document|requestAnimationFrame|HTMLElement|AudioContext)\b/,
      );
  });
});
