import { describe, expect, it } from "vitest";
import { sha256Hex } from "./hash.js";

describe("sha256Hex", () => {
  it("returns a stable hex digest, optionally truncated", () => {
    expect(sha256Hex("look")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex("look", 16)).toHaveLength(16);
    expect(sha256Hex("look", 16)).toBe(sha256Hex("look").slice(0, 16));
  });
});
