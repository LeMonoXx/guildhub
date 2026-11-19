import { describe, expect, it } from "vitest";
import type { GuildCheck, MemberState } from "./guild-check.js";
import { calendarDay, daysBefore, sameState } from "./guild-check.js";
import { diffChecks, eventsOf, guildSeries, memberSeries } from "./history.js";

function member(overrides: Partial<MemberState> = {}): MemberState {
  return {
    characterId: "1",
    slug: "aria",
    name: "Aria",
    surname: "Stormwind",
    classId: "mage",
    level: 20,
    rankId: 3,
    published: true,
    itemLevel: 18,
    achievementPoints: 100,
    achievements: 10,
    equipment: [
      { slot: "HEAD", itemId: 100, name: "Old Hat", quality: "COMMON" },
    ],
    professions: [{ name: "Tailoring", skill: 50 }],
    reputations: [
      { factionId: 72, faction: "Stormwind", standing: "Neutral", tier: 3 },
    ],
    mounts: [],
    ...overrides,
  };
}

function day(date: string, members: MemberState[], points = 0): GuildCheck {
  return {
    day: date,
    recordedAt: new Date(`${date}T04:00:00.000Z`),
    checkedAt: new Date(`${date}T04:00:00.000Z`),
    achievementPoints: points,
    members,
  };
}

describe("diffChecks", () => {
  it("reports nothing when nothing changed", () => {
    expect(
      diffChecks(day("2026-11-01", [member()]), day("2026-11-02", [member()])),
    ).toEqual([]);
  });

  it("does not mistake a change of language for new professions or mounts", () => {
    const english = day("2026-11-01", [member({ mounts: ["Pinto"] })]);
    const german = {
      ...day("2026-11-02", [
        member({
          professions: [{ name: "Schneiderei", skill: 50 }],
          mounts: ["Schecke"],
        }),
      ]),
      locale: "de" as const,
    };
    expect(diffChecks(english, german)).toEqual([]);
  });

  it("reports joins and departures without further detail", () => {
    const events = diffChecks(
      day("2026-11-01", [member()]),
      day("2026-11-02", [
        member({ characterId: "2", slug: "brom", name: "Brom" }),
      ]),
    );
    expect(events.map((event) => [event.kind, event.slug])).toEqual([
      ["joined", "brom"],
      ["left", "aria"],
    ]);
  });

  it("reports every profile change of a published member", () => {
    const events = diffChecks(
      day("2026-11-01", [member()]),
      day("2026-11-02", [
        member({
          level: 22,
          rankId: 2,
          achievementPoints: 130,
          achievements: 12,
          equipment: [
            {
              slot: "HEAD",
              itemId: 200,
              name: "Crown",
              quality: "EPIC",
              itemLevel: 60,
            },
          ],
          professions: [
            { name: "Tailoring", skill: 75 },
            { name: "Cooking", skill: 1 },
          ],
          reputations: [
            {
              factionId: 72,
              faction: "Stormwind",
              standing: "Friendly",
              tier: 4,
            },
            {
              factionId: 69,
              faction: "Darnassus",
              standing: "Neutral",
              tier: 3,
            },
          ],
          mounts: ["Black Stallion"],
        }),
      ]),
    );
    expect(events).toEqual([
      expect.objectContaining({
        kind: "level",
        from: 20,
        to: 22,
        day: "2026-11-02",
      }),
      expect.objectContaining({ kind: "rank", from: 3, to: 2 }),
      expect.objectContaining({
        kind: "item",
        slot: "HEAD",
        item: "Crown",
        quality: "EPIC",
        itemLevel: 60,
      }),
      expect.objectContaining({
        kind: "profession",
        profession: "Tailoring",
        from: 50,
        to: 75,
      }),
      expect.objectContaining({
        kind: "profession",
        profession: "Cooking",
        from: 0,
        to: 1,
      }),
      expect.objectContaining({
        kind: "reputation",
        faction: "Stormwind",
        standing: "Friendly",
      }),
      expect.objectContaining({ kind: "achievements", count: 2, points: 30 }),
      expect.objectContaining({ kind: "mount", mount: "Black Stallion" }),
    ]);
  });

  it("lists each new achievement at the time it was earned", () => {
    const first = {
      id: 6,
      name: "Level 10",
      at: "2026-11-01T20:00:00.000Z",
    };
    const events = diffChecks(
      day("2026-11-01", [member({ recentAchievements: [first] })]),
      day("2026-11-02", [
        member({
          achievements: 12,
          achievementPoints: 120,
          recentAchievements: [
            {
              id: 7,
              name: "Level 20",
              iconUrl: "/icons/7",
              at: "2026-11-02T01:30:00.000Z",
            },
            { id: 8, name: "Explore Elwynn", at: "2026-11-02T02:10:00.000Z" },
            first,
          ],
        }),
      ]),
    );
    expect(events).toEqual([
      expect.objectContaining({
        kind: "achievement",
        achievementId: 7,
        achievement: "Level 20",
        iconUrl: "/icons/7",
        at: "2026-11-02T01:30:00.000Z",
      }),
      expect.objectContaining({
        kind: "achievement",
        achievementId: 8,
        at: "2026-11-02T02:10:00.000Z",
      }),
    ]);
  });

  it("orders events across checks by when they happened, newest first", () => {
    const events = eventsOf([
      day("2026-11-01", [member({ recentAchievements: [] })]),
      day("2026-11-02", [
        member({
          level: 21,
          achievements: 11,
          recentAchievements: [
            { id: 9, name: "Early", at: "2026-11-02T03:00:00.000Z" },
          ],
        }),
      ]),
    ]);
    expect(events.map((event) => event.kind)).toEqual(["level", "achievement"]);
  });

  it("does not invent changes when a profile was not published one of the days", () => {
    const hidden = member({
      published: false,
      equipment: [],
      professions: [],
      mounts: [],
    });
    const events = diffChecks(
      day("2026-11-01", [hidden]),
      day("2026-11-02", [member({ level: 21 })]),
    );
    expect(events.map((event) => event.kind)).toEqual(["level"]);
  });

  it("reports completed quests only when both checks counted them", () => {
    const counted = diffChecks(
      day("2026-11-01", [member({ questsCompleted: 4 })]),
      day("2026-11-02", [member({ questsCompleted: 7 })]),
    );
    expect(counted).toEqual([
      expect.objectContaining({ kind: "quests", from: 4, to: 7 }),
    ]);
    const uncounted = diffChecks(
      day("2026-11-01", [member()]),
      day("2026-11-02", [member({ questsCompleted: 7 })]),
    );
    expect(uncounted).toEqual([]);
  });
});

describe("achievements across checks", () => {
  function at(time: string, members: MemberState[]): GuildCheck {
    return {
      day: time.slice(0, 10),
      recordedAt: new Date(time),
      checkedAt: new Date(time),
      achievementPoints: 0,
      members,
    };
  }
  const rare = { id: 9, name: "Rare", at: "2026-11-02T13:28:00.000Z" };

  it("shows an achievement Battle.net listed late once, when it was earned", () => {
    const events = eventsOf([
      at("2026-11-02T13:00:00.000Z", [member({ recentAchievements: [] })]),
      at("2026-11-02T14:00:00.000Z", [
        member({ achievements: 11, recentAchievements: [] }),
      ]),
      at("2026-11-02T15:00:00.000Z", [
        member({ achievements: 11, recentAchievements: [rare] }),
      ]),
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        kind: "achievement",
        achievementId: 9,
        at: rare.at,
      }),
    ]);
  });

  it("waits for Battle.net to name an achievement it already counted", () => {
    const known = { id: 6, name: "Known", at: "2026-11-01T20:00:00.000Z" };
    const events = diffChecks(
      at("2026-11-02T13:00:00.000Z", [member({ recentAchievements: [known] })]),
      at("2026-11-02T14:00:00.000Z", [
        member({ achievements: 11, recentAchievements: [known] }),
      ]),
    );
    expect(events).toEqual([]);
  });

  it("counts achievements of checks recorded before they were listed", () => {
    const events = eventsOf([
      at("2026-11-02T13:00:00.000Z", [member()]),
      at("2026-11-02T14:00:00.000Z", [
        member({ achievements: 12, achievementPoints: 130 }),
      ]),
    ]);
    expect(events).toEqual([
      expect.objectContaining({ kind: "achievements", count: 2, points: 30 }),
    ]);
  });

  it("counts what a full list could not show beside the achievements it did", () => {
    const events = diffChecks(
      at("2026-11-02T13:00:00.000Z", [member({ recentAchievements: [] })]),
      at("2026-11-02T14:00:00.000Z", [
        member({
          achievements: 13,
          achievementPoints: 160,
          recentAchievements: [rare],
        }),
      ]),
    );
    expect(events).toEqual([
      expect.objectContaining({ kind: "achievement", achievementId: 9 }),
      expect.objectContaining({ kind: "achievements", count: 2, points: 0 }),
    ]);
  });
});

describe("sameState", () => {
  it("ignores roster order and the time of the check", () => {
    const aria = member();
    const brom = member({ characterId: "2", slug: "brom" });
    expect(
      sameState(
        day("2026-11-01", [aria, brom], 5),
        day("2026-11-02", [brom, aria], 5),
      ),
    ).toBe(true);
  });

  it("sees any change of a member", () => {
    expect(
      sameState(
        day("2026-11-01", [member()]),
        day("2026-11-01", [member({ questsCompleted: 1 })]),
      ),
    ).toBe(false);
  });
});

describe("eventsOf", () => {
  it("lists the newest check first and treats the first check as the baseline", () => {
    const events = eventsOf([
      day("2026-11-01", [member()]),
      day("2026-11-02", [member({ level: 21 })]),
      day("2026-11-03", [member({ level: 22 })]),
    ]);
    expect(events.map((event) => event.day)).toEqual([
      "2026-11-03",
      "2026-11-02",
    ]);
  });
});

describe("series", () => {
  const days = [
    day(
      "2026-11-01",
      [member(), member({ characterId: "2", level: 30, itemLevel: undefined })],
      500,
    ),
    day("2026-11-02", [member({ level: 21 })], 510),
  ];

  it("averages the guild per check and sums the members' achievements", () => {
    expect(guildSeries(days)).toEqual([
      {
        day: "2026-11-01",
        at: "2026-11-01T04:00:00.000Z",
        members: 2,
        averageLevel: 25,
        averageItemLevel: 18,
        achievements: 20,
      },
      {
        day: "2026-11-02",
        at: "2026-11-02T04:00:00.000Z",
        members: 1,
        averageLevel: 21,
        averageItemLevel: 18,
        achievements: 10,
      },
    ]);
  });

  it("adds a member point only when the member's own values moved", () => {
    const aria = member();
    const checks = [
      day("2026-11-01", [aria]),
      day("2026-11-02", [aria, member({ characterId: "2", slug: "brom" })]),
      day("2026-11-03", [member({ level: 21 })]),
    ];
    expect(memberSeries(checks, "1").map((point) => point.day)).toEqual([
      "2026-11-01",
      "2026-11-03",
    ]);
  });

  it("follows one member across checks", () => {
    expect(memberSeries(days, "2")).toEqual([
      {
        day: "2026-11-01",
        at: "2026-11-01T04:00:00.000Z",
        level: 30,
        achievements: 10,
      },
    ]);
  });
});

describe("calendar days", () => {
  it("uses the configured time zone", () => {
    const lateEvening = new Date("2026-11-14T23:30:00.000Z");
    expect(calendarDay(lateEvening, "Europe/Berlin")).toBe("2026-11-15");
    expect(calendarDay(lateEvening, "UTC")).toBe("2026-11-14");
  });

  it("counts back across month ends", () => {
    expect(daysBefore("2026-03-01", 1)).toBe("2026-02-28");
  });
});
