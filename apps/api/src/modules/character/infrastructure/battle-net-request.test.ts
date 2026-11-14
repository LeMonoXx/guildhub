import type { BlizzardApiClient } from "@blizzard-api/client";
import { describe, expect, it } from "vitest";
import { sendBattleNetPatiently } from "./battle-net-request.js";

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

describe("sendBattleNetPatiently", () => {
  it("waits as asked and tries a throttled request again", async () => {
    const { client, calls } = clientAnswering(throttled("2"), { id: 1 });
    const waits: number[] = [];
    const result = await sendBattleNetPatiently(client, resource, {
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
      sleep: () => Promise.resolve(),
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "character.not_found" },
    });
    expect(calls()).toBe(1);
  });
});
