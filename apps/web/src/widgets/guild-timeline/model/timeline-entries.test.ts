import { describe, expect, test } from "vitest";
import { toTimelineEntries, type TimelineEvent } from "./timeline-entries";

const event = (kind: "login" | "achievement", slug: string): TimelineEvent => ({
  kind,
  slug,
  name: slug,
  surname: "",
  classId: "1",
  at: "2026-11-14T12:00:00.000Z",
  title: kind,
});

describe("toTimelineEntries", () => {
  test("folds a run of logins into one row and keeps achievements apart", () => {
    const entries = toTimelineEntries([
      event("login", "a"),
      event("login", "b"),
      event("achievement", "c"),
      event("login", "d"),
    ]);
    expect(
      entries.map((entry) =>
        entry.kind === "login" ? entry.events.length : entry.kind,
      ),
    ).toEqual([2, "achievement", 1]);
  });
});
