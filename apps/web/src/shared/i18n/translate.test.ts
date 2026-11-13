import { describe, expect, test } from "vitest";
import { deMessages, enMessages } from "./messages";
import { translate } from "./translate";

describe("translate", () => {
  test("fills placeholders and falls back to the key", () => {
    expect(translate(enMessages, "members.count", { count: 14 })).toBe(
      "14 members",
    );
    expect(translate(deMessages, "members.count", { count: 14 })).toBe(
      "14 Mitglieder",
    );
    expect(translate(enMessages, "missing.key")).toBe("missing.key");
  });
});
