import { describe, expect, it } from "vitest";
import { appError } from "./app-error.js";
import { err, ok } from "./result.js";

describe("Result", () => {
  it("wraps a value and an error", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err(appError("internal")).ok).toBe(false);
  });
});
