import { describe, expect, test } from "vitest";
import { wowClassColorVar } from "./class-color";

describe("wowClassColorVar", () => {
  test("maps a class id onto the shared CSS token", () => {
    expect(wowClassColorVar("4")).toBe("var(--class-4, var(--color-ink))");
    expect(wowClassColorVar("11")).toBe("var(--class-11, var(--color-ink))");
  });

  test("falls back when the id is not a class number", () => {
    expect(wowClassColorVar("rogue")).toBe("var(--color-ink)");
  });
});
