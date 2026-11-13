import { describe, expect, test } from "vitest";
import { createFixtureGuildSource } from "./fixture-source";
import { guildQueries } from "./queries";

describe("guild fixture queries", () => {
  test("load profile, roster, and featured members through the data source", async () => {
    const queries = guildQueries(createFixtureGuildSource());
    const profile = await queries.profile().queryFn();
    const roster = await queries.roster().queryFn();
    const featured = await queries.featured().queryFn();
    expect(profile.name).toBe("Nightveil");
    expect(roster.members).toHaveLength(profile.memberCount);
    expect(featured.members).toHaveLength(6);
    expect(
      new Set(featured.members.map((member) => member.lookManifest)).size,
    ).toBe(1);
  });
});
