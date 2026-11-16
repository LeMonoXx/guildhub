import { describe, expect, it } from "vitest";
import { rewriteBattleNetRequest } from "./client.js";

describe("rewriteBattleNetRequest", () => {
  it("rewrites API and OAuth hosts onto the configured base", () => {
    const rewrite = rewriteBattleNetRequest("http://127.0.0.1:8787");
    const api = rewrite(
      new Request("https://eu.api.blizzard.com/data/wow/guild/example-guild"),
    );
    const token = rewrite(
      new Request(
        "https://oauth.battle.net/token?grant_type=client_credentials",
      ),
    );

    expect(api.url).toBe("http://127.0.0.1:8787/data/wow/guild/example-guild");
    expect(token.url).toBe(
      "http://127.0.0.1:8787/token?grant_type=client_credentials",
    );
  });

  it("leaves unrelated hosts alone", () => {
    const rewrite = rewriteBattleNetRequest("http://127.0.0.1:8787");
    const request = new Request("https://example.test/health");
    expect(rewrite(request)).toBe(request);
  });
});
