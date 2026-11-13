import { describe, expect, it } from "vitest";
import { guildEndpoint, guildRosterEndpoint } from "./wow-forever-guild.js";

describe("wow-forever guild endpoints", () => {
  it("describes the guild profile path", () => {
    expect(guildEndpoint("example-guild")).toMatchObject({
      namespace: "profile-forever",
      path: "/data/wow/guild/example-guild",
    });
  });

  it("describes the guild roster path", () => {
    expect(guildRosterEndpoint("example-guild")).toMatchObject({
      namespace: "profile-forever",
      path: "/data/wow/guild/example-guild/roster",
    });
  });
});
