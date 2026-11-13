import { describe, expect, test } from "vitest";
import { formatDocumentTitle } from "./document-title";

describe("document title", () => {
  test("joins the page name with the guild name when present", () => {
    expect(formatDocumentTitle("Roster", "Nightveil")).toBe(
      "Roster · Nightveil",
    );
    expect(formatDocumentTitle("Nightveil")).toBe("Nightveil");
  });
});
