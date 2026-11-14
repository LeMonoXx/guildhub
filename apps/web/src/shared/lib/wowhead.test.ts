import { describe, expect, it } from "vitest";
import { wowheadUrl } from "./wowhead";

describe("wowheadUrl", () => {
  it("links WoW Forever's pages", () => {
    expect(wowheadUrl("item", 279260, "en")).toBe(
      "https://www.wowhead.com/forever/item=279260",
    );
  });

  it("opens the German pages for German readers", () => {
    expect(wowheadUrl("spell", 17803, "de")).toBe(
      "https://www.wowhead.com/forever/de/spell=17803",
    );
  });
});
