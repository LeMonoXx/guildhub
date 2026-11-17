import type { ContentLocale } from "@guildhub/contracts";
import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../../character/domain/profile.js";
import type { MemberProfile } from "../../character/index.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import { ok } from "../../../platform/kernel/result.js";
import type { GuildCheck } from "../domain/guild-check.js";
import { makeGetCharacterHistory, makeGetGuildHistory } from "./get-history.js";
import type { HistoryStore } from "./ports.js";
import { makeRecordGuildCheck } from "./record-guild-check.js";

const guild = { slug: "example" };

function memoryStore(): HistoryStore & { checks: GuildCheck[] } {
  const checks: GuildCheck[] = [];
  const inLocale = (locale: ContentLocale) =>
    checks.filter((check) => check.locale === locale);
  return {
    checks,
    latest: (_guild, locale) => Promise.resolve(inLocale(locale).at(-1)),
    append: (_guild, check) => {
      checks.push(check);
      return Promise.resolve();
    },
    confirm: (_guild, check, checkedAt) => {
      const index = checks.indexOf(check);
      checks[index] = { ...check, checkedAt };
      return Promise.resolve();
    },
    since: (_guild, fromDay, locale) =>
      Promise.resolve(
        inLocale(locale).filter(
          (check) => check.checkedAt.toISOString().slice(0, 10) >= fromDay,
        ),
      ),
    firstDay: () => Promise.resolve(checks[0]?.day),
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

interface Progress {
  level: number;
  quests: number;
}

function profile(
  { level, quests }: Progress,
  locale: ContentLocale = "en",
): MemberProfile {
  const data = emptyProfileData(level);
  return {
    member: { ...roster, level },
    profile: {
      characterId: roster.characterId,
      slug: roster.slug,
      status: "available",
      data: {
        ...data,
        summary: { level, achievementPoints: 50, equippedItemLevel: 21 },
        collections: {
          mounts: [locale === "de" ? "Schecke" : "Pinto"],
          pets: [],
          toys: [],
          heirlooms: [],
        },
        quests: { ...data.quests, completedCount: quests },
      },
      fetchedAt: new Date(),
    },
  };
}

function setup(now: { value: Date }, progress: Progress) {
  const store = memoryStore();
  const clock = { now: () => now.value };
  const record = makeRecordGuildCheck({
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
      Promise.resolve([profile(progress, locale)]),
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
  it("confirms the latest check when nothing changed", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const { store, record, guildHistory } = setup(now, {
      level: 24,
      quests: 10,
    });
    await record(guild);
    now.value = new Date("2026-11-13T05:00:00.000Z");
    await record(guild);
    expect(
      store.checks.map((check) => `${check.day} ${check.locale ?? ""}`).sort(),
    ).toEqual(["2026-11-13 de", "2026-11-13 en"]);
    expect(store.checks.find((check) => check.locale === "en")).toMatchObject({
      recordedAt: new Date("2026-11-13T04:00:00.000Z"),
      checkedAt: new Date("2026-11-13T05:00:00.000Z"),
      achievementPoints: 900,
      members: [
        {
          slug: "ann-example",
          published: true,
          itemLevel: 21,
          achievementPoints: 50,
          questsCompleted: 10,
          mounts: ["Pinto"],
        },
      ],
    });
    expect((await guildHistory(guild, "en")).checkedAt).toBe(
      "2026-11-13T05:00:00.000Z",
    );
  });

  it("keeps every hourly change of the same day", async () => {
    const now = { value: new Date("2026-11-13T08:00:00.000Z") };
    const progress = { level: 24, quests: 10 };
    const { record, guildHistory, characterHistory } = setup(now, progress);
    await record(guild);
    now.value = new Date("2026-11-13T09:00:00.000Z");
    progress.level = 25;
    await record(guild);
    now.value = new Date("2026-11-13T10:00:00.000Z");
    progress.level = 26;
    await record(guild);

    const history = await guildHistory(guild, "en");
    expect(history.since).toBe("2026-11-13");
    expect(history.series.map((point) => point.averageLevel)).toEqual([
      24, 25, 26,
    ]);
    expect(history.events).toEqual([
      expect.objectContaining({
        kind: "level",
        from: 25,
        to: 26,
        at: "2026-11-13T10:00:00.000Z",
      }),
      expect.objectContaining({
        kind: "level",
        from: 24,
        to: 25,
        at: "2026-11-13T09:00:00.000Z",
      }),
    ]);

    const character = await characterHistory({
      guild,
      slug: "ann-example",
      locale: "en",
    });
    expect(character.series.map((point) => point.at)).toEqual([
      "2026-11-13T08:00:00.000Z",
      "2026-11-13T09:00:00.000Z",
      "2026-11-13T10:00:00.000Z",
    ]);
    expect(character.events).toHaveLength(2);
  });

  it("reports completed quests", async () => {
    const now = { value: new Date("2026-11-13T08:00:00.000Z") };
    const progress = { level: 24, quests: 10 };
    const { record, characterHistory } = setup(now, progress);
    await record(guild);
    now.value = new Date("2026-11-13T09:00:00.000Z");
    progress.quests = 13;
    await record(guild);
    const character = await characterHistory({
      guild,
      slug: "ann-example",
      locale: "en",
    });
    expect(character.events).toEqual([
      expect.objectContaining({ kind: "quests", from: 10, to: 13 }),
    ]);
    expect(character.series.map((point) => point.quests)).toEqual([10, 13]);
  });

  it("dates a change by the hourly check that saw it", async () => {
    const now = { value: new Date("2026-11-13T22:00:00.000Z") };
    const progress = { level: 24, quests: 10 };
    const { record, guildHistory } = setup(now, progress);
    await record(guild);
    now.value = new Date("2026-11-14T09:00:00.000Z");
    progress.level = 25;
    await record(guild);
    expect((await guildHistory(guild, "en")).events).toEqual([
      expect.objectContaining({ kind: "level", to: 25, day: "2026-11-14" }),
    ]);
  });

  it("serves each language's own checks", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const { record, characterHistory } = setup(now, { level: 24, quests: 0 });
    await record(guild);
    const german = await characterHistory({
      guild,
      slug: "ann-example",
      locale: "de",
    });
    expect(german.series).toHaveLength(1);
  });

  it("returns an empty history for a character not checked yet", async () => {
    const now = { value: new Date("2026-11-13T04:00:00.000Z") };
    const { characterHistory } = setup(now, { level: 24, quests: 0 });
    expect(
      await characterHistory({ guild, slug: "new-member", locale: "en" }),
    ).toEqual({
      series: [],
      events: [],
    });
  });
});
