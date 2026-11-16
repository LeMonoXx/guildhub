import type { GuildDossier } from "@guildhub/contracts";
import { describe, expect, test } from "vitest";
import { sortDossiers } from "./dossier-order";

const dossier = (slug: string, fields: Partial<GuildDossier>) =>
  ({
    slug,
    level: 60,
    achievementPoints: 0,
    ...fields,
  }) as GuildDossier;

describe("sortDossiers", () => {
  const a = dossier("a", { level: 58, averageItemLevel: 70 });
  const b = dossier("b", { achievementPoints: 10, lastLoginAt: "2026-11-01" });
  const c = dossier("c", { averageItemLevel: 60, lastLoginAt: "2026-11-10" });

  test("orders by level, then achievement points", () => {
    expect(sortDossiers([a, c, b], "level").map(({ slug }) => slug)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  test("puts members without item level or login last", () => {
    expect(
      sortDossiers([b, c, a], "itemLevel").map(({ slug }) => slug),
    ).toEqual(["a", "c", "b"]);
    expect(sortDossiers([a, b, c], "recent").map(({ slug }) => slug)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});
