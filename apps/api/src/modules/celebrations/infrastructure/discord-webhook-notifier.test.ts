import { describe, expect, it } from "vitest";
import type { Celebration } from "../domain/celebration.js";
import { makeDiscordWebhookNotifier } from "./discord-webhook-notifier.js";

const member = { slug: "ann-example", name: "Ann", classId: "4" };
const craft = (milestone: number): Celebration => ({
  kind: "profession",
  member,
  profession: "Schmiedekunst",
  milestone,
});

function setup(status = 204) {
  const bodies: unknown[] = [];
  const notifier = makeDiscordWebhookNotifier({
    webhookUrl: "https://discord.example/api/webhooks/1/secret",
    siteUrl: "https://guild.example",
    locale: "de",
    fetch: (_url, init) => {
      bodies.push(JSON.parse(init?.body as string));
      return Promise.resolve(new Response(null, { status }));
    },
  });
  return { bodies, notifier };
}

describe("discord webhook notifier", () => {
  it("posts a linked embed in the class colour without pinging anyone", async () => {
    const { bodies, notifier } = setup();
    await notifier.announce([craft(300)]);
    expect(bodies).toEqual([
      {
        allowed_mentions: { parse: [] },
        embeds: [
          expect.objectContaining({
            title: "Ann: Schmiedekunst auf 300",
            url: "https://guild.example/characters/ann-example",
            color: 0xfff569,
            thumbnail: {
              url: "https://guild.example/api/characters/ann-example/avatar",
            },
          }),
        ],
      },
    ]);
  });

  it("fits as many celebrations in a post as Discord takes", () => {
    expect(setup().notifier.batchSize).toBe(10);
  });

  it("fails without echoing the secret webhook address", async () => {
    const { notifier } = setup(429);
    await expect(notifier.announce([craft(150)])).rejects.toThrow(
      "Discord webhook answered 429",
    );
  });
});
