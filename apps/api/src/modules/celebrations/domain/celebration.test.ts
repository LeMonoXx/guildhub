import type { HistoryEvent } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { celebrationsOf } from "./celebration.js";

const base = {
  slug: "ann-example",
  name: "Ann",
  surname: "Example",
  classId: "4",
  day: "2026-11-17",
  at: "2026-11-17T10:00:00.000Z",
};
const member = { slug: "ann-example", name: "Ann", classId: "4" };

const level = (from: number, to: number): HistoryEvent => ({
  ...base,
  kind: "level",
  from,
  to,
});

const profession = (from: number, to: number): HistoryEvent => ({
  ...base,
  kind: "profession",
  profession: "Schmiedekunst",
  from,
  to,
});

const reputation = (tier: number): HistoryEvent => ({
  ...base,
  kind: "reputation",
  faction: "Orgrimmar",
  standing: "Ehrfürchtig",
  tier,
});

describe("celebrationsOf", () => {
  it("cheers the level cap but not the levels before it", () => {
    expect(celebrationsOf([level(58, 59), level(59, 60)])).toEqual([
      { kind: "levelCap", member, level: 60 },
    ]);
  });

  it("cheers the highest profession milestone a jump crossed", () => {
    expect(
      celebrationsOf([profession(140, 149), profession(149, 230)]),
    ).toEqual([
      {
        kind: "profession",
        member,
        profession: "Schmiedekunst",
        milestone: 225,
      },
    ]);
  });

  it("cheers a profession that lands exactly on a milestone", () => {
    expect(celebrationsOf([profession(299, 300)])).toEqual([
      {
        kind: "profession",
        member,
        profession: "Schmiedekunst",
        milestone: 300,
      },
    ]);
  });

  it("cheers reputation from Revered on", () => {
    expect(celebrationsOf([reputation(5), reputation(6)])).toEqual([
      {
        kind: "reputation",
        member,
        faction: "Orgrimmar",
        standing: "Ehrfürchtig",
        tier: 6,
      },
    ]);
  });

  it("cheers new achievements", () => {
    expect(
      celebrationsOf([{ ...base, kind: "achievements", count: 2, points: 20 }]),
    ).toEqual([{ kind: "achievements", member, count: 2, points: 20 }]);
  });

  it("cheers each achievement by name", () => {
    expect(
      celebrationsOf([
        {
          ...base,
          kind: "achievement",
          achievementId: 7,
          achievement: "Level 20",
          iconUrl: "/icons/7",
        },
      ]),
    ).toEqual([
      {
        kind: "achievement",
        member,
        achievement: "Level 20",
        iconUrl: "/icons/7",
      },
    ]);
  });

  it("ignores everyday changes", () => {
    expect(
      celebrationsOf([
        { ...base, kind: "quests", from: 10, to: 12 },
        { ...base, kind: "mount", mount: "Schecke" },
        { ...base, kind: "joined" },
      ]),
    ).toEqual([]);
  });
});
