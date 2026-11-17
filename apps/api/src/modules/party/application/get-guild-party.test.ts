import { describe, expect, it } from "vitest";
import { emptyProfileData } from "../../character/domain/profile.js";
import { rankId, type RosterMember } from "../../guild/index.js";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import { makeGetGuildParty } from "./get-guild-party.js";

const guild = { slug: "example" };
const fetchedAt = new Date("2026-11-17T12:00:00.000Z");

const member: RosterMember = {
  characterId: "7",
  name: "Ann",
  surname: "Example",
  level: 23,
  rankId: rankId(2),
  classId: "1",
  raceId: "2",
  slug: "ann-example",
};

const getGuild = () =>
  Promise.resolve(
    ok({
      data: {
        id: "1",
        slug: guild.slug,
        name: "Example",
        faction: "ALLIANCE" as const,
        achievementPoints: 0,
        memberCount: 1,
      },
      fetchedAt,
      stale: false,
    }),
  );

describe("getGuildParty", () => {
  it("plans the party from every member's profile in the asked locale", async () => {
    const locales: string[] = [];
    const getParty = makeGetGuildParty({
      getGuild,
      getRoster: () =>
        Promise.resolve(ok({ data: [member], fetchedAt, stale: true })),
      loadProfiles: (members, locale) => {
        locales.push(locale);
        return Promise.resolve(
          members.map((m) => ({
            member: m,
            profile: {
              characterId: m.characterId,
              slug: m.slug,
              status: "available" as const,
              data: emptyProfileData(m.level),
              fetchedAt,
            },
          })),
        );
      },
    });

    const result = await getParty(guild, "de");

    expect(locales).toEqual(["de"]);
    expect(result.ok && result.value.stale).toBe(true);
    const party = result.ok ? result.value.data : undefined;
    expect(party?.members.map((m) => m.slug)).toEqual(["ann-example"]);
    expect(party?.dungeons.map((d) => d.key)).toContain("deadmines");
  });

  it("passes a roster failure through", async () => {
    const getParty = makeGetGuildParty({
      getGuild,
      getRoster: () => Promise.resolve(err(appError("upstream.unavailable"))),
      loadProfiles: () => Promise.resolve([]),
    });

    const result = await getParty(guild, "en");

    expect(result.ok).toBe(false);
  });
});
