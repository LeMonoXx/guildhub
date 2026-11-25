import type { BlizzardApiClient } from "@blizzard-api/client";
import { describe, expect, it } from "vitest";
import { sendBattleNet, sendBattleNetPatiently } from "./request.js";

const throttled = (retryAfter: string) =>
  Object.assign(new Error("Too Many Requests"), {
    response: new Response(null, {
      status: 429,
      headers: { "Retry-After": retryAfter },
    }),
  });

const clientAnswering = (...answers: (Error | object)[]) => {
  let calls = 0;
  const client = {
    defaults: { token: "token" },
    sendRequest: () => {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      return answer instanceof Error
        ? Promise.reject(answer)
        : Promise.resolve(answer);
    },
  } as unknown as BlizzardApiClient;
  return { client, calls: () => calls };
};

const resource = { path: "/data/wow/item/1", namespace: "static" } as never;

describe("sendBattleNet", () => {
  it("refreshes an expired token and reads again", async () => {
    const unauthorized = Object.assign(new Error("Unauthorized"), {
      response: new Response(null, { status: 401 }),
    });
    let refreshed = 0;
    let calls = 0;
    const client = {
      defaults: { token: "expired" },
      refreshAccessToken: () => {
        refreshed += 1;
        return Promise.resolve({ access_token: "fresh", expires_in: 3600 });
      },
      sendRequest: () => {
        calls += 1;
        return calls === 1
          ? Promise.reject(unauthorized)
          : Promise.resolve({ id: 7 });
      },
    } as unknown as BlizzardApiClient;
    const result = await sendBattleNet(client, resource, {
      notFound: "character.not_found",
    });
    expect(result).toEqual({ ok: true, value: { id: 7 } });
    expect(refreshed).toBe(1);
    expect(calls).toBe(2);
  });
});

describe("sendBattleNetPatiently", () => {
  it("waits as asked and tries a throttled request again", async () => {
    const { client, calls } = clientAnswering(throttled("2"), { id: 1 });
    const waits: number[] = [];
    const result = await sendBattleNetPatiently(client, resource, {
      notFound: "character.not_found",
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    });
    expect(result).toEqual({ ok: true, value: { id: 1 } });
    expect(calls()).toBe(2);
    expect(waits).toEqual([2000]);
  });

  it("gives up after the last attempt", async () => {
    const { client, calls } = clientAnswering(throttled("1"));
    const result = await sendBattleNetPatiently(client, resource, {
      notFound: "character.not_found",
      attempts: 3,
      sleep: () => Promise.resolve(),
    });
    expect(result.ok).toBe(false);
    expect(calls()).toBe(3);
  });

  it("does not retry a definite not-found", async () => {
    const missing = Object.assign(new Error("Not Found"), {
      response: new Response(null, { status: 404 }),
    });
    const { client, calls } = clientAnswering(missing);
    const result = await sendBattleNetPatiently(client, resource, {
      notFound: "character.not_found",
      sleep: () => Promise.resolve(),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "character.not_found" },
    });
    expect(calls()).toBe(1);
  });
});
