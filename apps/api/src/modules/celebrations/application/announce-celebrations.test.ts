import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import type { Celebration } from "../domain/celebration.js";
import { makeAnnounceCelebrations } from "./announce-celebrations.js";

const capped: HistoryEvent = {
  slug: "ann-example",
  name: "Ann",
  surname: "Example",
  classId: "4",
  day: "2026-11-17",
  at: "2026-11-17T10:00:00.000Z",
  kind: "level",
  from: 59,
  to: 60,
};

function setup() {
  const posted: (readonly Celebration[])[] = [];
  const announce = makeAnnounceCelebrations({
    queue: {
      enqueue: (celebrations) => {
        posted.push(celebrations);
        return Promise.resolve();
      },
    },
    batchSize: 2,
    locale: "de",
  });
  return { posted, announce };
}

describe("announceCelebrations", () => {
  it("posts the milestones of a check in the channel's language", async () => {
    const { posted, announce } = setup();
    expect(await announce([capped], "de")).toBe(1);
    expect(posted).toEqual([[expect.objectContaining({ kind: "levelCap" })]]);
  });

  it("queues one post per batch", async () => {
    const { posted, announce } = setup();
    const capping = (slug: string): HistoryEvent => ({ ...capped, slug });
    expect(
      await announce([capping("a"), capping("b"), capping("c")], "de"),
    ).toBe(3);
    expect(posted.map((batch) => batch.length)).toEqual([2, 1]);
  });

  it("skips checks in other languages", async () => {
    const { posted, announce } = setup();
    expect(await announce([capped], "en")).toBe(0);
    expect(posted).toEqual([]);
  });

  it("posts nothing when no change is a milestone", async () => {
    const { posted, announce } = setup();
    expect(await announce([{ ...capped, from: 20, to: 21 }], "de")).toBe(0);
    expect(posted).toEqual([]);
  });
});
