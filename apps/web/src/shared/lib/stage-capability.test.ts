import { describe, expect, test } from "vitest";
import { canUseLiveStage } from "./stage-capability";

describe("live stage capability", () => {
  test("requires webgl, visibility, and the desktop motion query", () => {
    expect(
      canUseLiveStage({ webgl: true, visible: true, mediaMatches: true }),
    ).toBe(true);
    expect(
      canUseLiveStage({ webgl: false, visible: true, mediaMatches: true }),
    ).toBe(false);
    expect(
      canUseLiveStage({ webgl: true, visible: false, mediaMatches: true }),
    ).toBe(false);
    expect(
      canUseLiveStage({ webgl: true, visible: true, mediaMatches: false }),
    ).toBe(false);
  });
});
