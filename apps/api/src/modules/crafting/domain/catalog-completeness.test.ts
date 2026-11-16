import { describe, expect, it } from "vitest";
import { isCompleteEnough } from "./catalog-completeness.js";

describe("isCompleteEnough", () => {
  it("accepts a rebuild that answered at least four in five recipes", () => {
    expect(isCompleteEnough(80, 100)).toBe(true);
  });

  it("rejects a rebuild that lost more than one in five recipes", () => {
    expect(isCompleteEnough(79, 100)).toBe(false);
  });

  it("rejects an empty listing", () => {
    expect(isCompleteEnough(0, 0)).toBe(false);
  });
});
