import { describe, expect, it } from "vitest";
import {
  assignCharacterSlug,
  slugifyCharacterPart,
  uniquifySlugs,
} from "./character-slug.js";

describe("assignCharacterSlug", () => {
  it("joins name and surname as a lowercase slug", () => {
    expect(assignCharacterSlug("Guildmaster", "Example", "101")).toBe(
      "guildmaster-example",
    );
  });

  it("strips marks and punctuation", () => {
    expect(assignCharacterSlug("Éowyn", "O'Brien", "9")).toBe("eowyn-o-brien");
  });

  it("falls back to the character id when names are empty", () => {
    expect(assignCharacterSlug("---", "***", "101")).toBe("c101");
  });
});

describe("uniquifySlugs", () => {
  it("keeps the first slug and suffixes later collisions", () => {
    expect(
      uniquifySlugs([
        { slug: "shade-veil" },
        { slug: "shade-veil" },
        { slug: "vesper-veil" },
      ]),
    ).toEqual([
      { slug: "shade-veil" },
      { slug: "shade-veil-2" },
      { slug: "vesper-veil" },
    ]);
  });
});

describe("slugifyCharacterPart", () => {
  it("returns an empty string when nothing usable remains", () => {
    expect(slugifyCharacterPart("***")).toBe("");
  });
});
