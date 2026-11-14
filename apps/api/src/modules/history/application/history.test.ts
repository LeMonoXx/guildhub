import type { ContentLocale } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../../character/domain/profile.js";
import type { MemberProfile } from "../../character/index.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import { ok } from "../../../platform/kernel/result.js";
import type { GuildDay } from "../domain/guild-day.js";
import { makeGetCharacterHistory, makeGetGuildHistory } from "./get-history.js";
import type { HistoryStore } from "./ports.js";
import { makeRecordGuildDay } from "./record-guild-day.js";

const guild = { slug: "example" };

function memoryStore(): HistoryStore & { days: GuildDay[] } {
  const days: GuildDay[] = [];
  return {
    days,
    save: (_guild, day) => {
      const index = days.findIndex(
        (item) => item.day === day.day && item.locale === day.locale,
      );
      if (index === -1) days.push(day);
      else days[index] = day;
      days.sort((a, b) => a.day.localeCompare(b.day));
      return Promise.resolve();
    },
    since: (_guild, fromDay, locale) =>
      Promise.resolve(
        days.filter((item) => item.day >= fromDay && item.locale === locale),
      ),
    firstDay: () => Promise.resolve(days[0]?.day),
  };
}

const roster: RosterMember = {
  characterId: "7",
  name: "Ann",
  surname: "Example",
  level: 24,
  rankId: rankId(2),
  classId: "4",
  raceId: "2",
  slug: "ann-example",
};

function profile(
  level: number,
  status: "available" | "unavailable",
  locale: ContentLocale = "en",
): MemberProfile {
  return {
    member: { ...roster, level },
    profile: {
      characterId: roster.characterId,
      slug: roster.slug,
      status,
      data: {
        ...emptyProfileData(level),
        summary: { level, achievementPoints: 50, equippedItemLevel: 21 },
        collections: {
          mounts: [locale === "de" ? "Schecke" : "Pinto"],
          pets: [],
          toys: [],
          heirlooms: [],
        },
      },
      fetchedAt: new Date(),
    },
  };
}

function setup(now: { value: Date }, level: { value: number }) {
  const store = memoryStore();
  const clock = { now: () => now.value };
  const record = makeRecordGuildDay({
    getGuild: () =>
      Promise.resolve(
        ok({
          data: {
            id: "1",
            slug: guild.slug,
            name: "Example",
            faction: "HORDE" as const,
            achievementPoints: 900,
            memberCount: 1,
          },
          fetchedAt: now.value,
          stale: false,
        }),
      ),
    getRoster: () =>
      Promise.resolve(
        ok({ data: [roster], fetchedAt: now.value, stale: false }),
      ),
    loadProfiles: (_members, locale) =>
      Promise.resolve([profile(level.value, "available", locale)]),
    store,
    clock,
    timeZone: "Europe/Berlin",
    locales: ["en", "de"],
  });
  const deps = { store, clock, timeZone: "Europe/Berlin" };
  return {
    store,
    record,
    guildHistory: makeGetGuildHistory(deps),
    characterHistory: makeGetCharacterHistory(deps),
  };
}

describe("history", () => {
  it("records a day per calendar day in the guild's time zone", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const level = { value: 24 };
    const { store, record } = setup(now, level);
    await record(guild);
    await record(guild);
    expect(
      store.days.map((day) => `${day.day} ${day.locale ?? ""}`).sort(),
    ).toEqual(["2026-11-13 de", "2026-11-13 en"]);
    expect(store.days.find((day) => day.locale === "en")).toMatchObject({
      achievementPoints: 900,
      members: [
        {
          slug: "ann-example",
          published: true,
          itemLevel: 21,
          achievementPoints: 50,
          mounts: ["Pinto"],
        },
      ],
    });
  });

  it("serves the series and the changes between recorded days", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const level = { value: 24 };
    const { record, guildHistory, characterHistory } = setup(now, level);
    await record(guild);
    now.value = new Date("2026-11-14T04:00:00.000Z");
    level.value = 25;
    await record(guild);

    const history = await guildHistory(guild, "en");
    expect(history.since).toBe("2026-11-13");
    expect(history.series.map((point) => point.averageLevel)).toEqual([24, 25]);
    expect(history.events).toEqual([
      expect.objectContaining({
        kind: "level",
        from: 24,
        to: 25,
        day: "2026-11-14",
      }),
    ]);

    const character = await characterHistory({
      guild,
      slug: "ann-example",
      locale: "en",
    });
    expect(character.series.map((point) => point.level)).toEqual([24, 25]);
    expect(character.events).toHaveLength(1);
  });

  it("serves each language's own recording", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const { record, characterHistory } = setup(now, { value: 24 });
    await record(guild);
    const german = await characterHistory({
      guild,
      slug: "ann-example",
      locale: "de",
    });
    expect(german.series).toHaveLength(1);
  });

  it("returns an empty history for a character not recorded yet", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const { characterHistory } = setup(now, { value: 24 });
    expect(
      await characterHistory({ guild, slug: "new-member", locale: "en" }),
    ).toEqual({
      series: [],
      events: [],
    });
  });
});
