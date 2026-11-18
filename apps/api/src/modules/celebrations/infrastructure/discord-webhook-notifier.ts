import type { ContentLocale } from "@guildhub/contracts";
import type { CelebrationNotifier } from "../application/ports.js";
import type { Celebration } from "../domain/celebration.js";
import { celebrationText } from "./discord-texts.js";

/** Discord rejects a message with more embeds than this. */
const EMBEDS_PER_MESSAGE = 10;

const CLASS_COLORS: Readonly<Record<string, number>> = {
  "1": 0xc79c6e,
  "2": 0xf58cba,
  "3": 0xabd473,
  "4": 0xfff569,
  "5": 0xffffff,
  "6": 0xc41e3a,
  "7": 0x0070de,
  "8": 0x69ccf0,
  "9": 0x9482c9,
  "10": 0x00ff98,
  "11": 0xff7d0a,
  "12": 0xa330c9,
  "13": 0x33937f,
};
const FALLBACK_COLOR = 0x7fd1c1;

export interface DiscordWebhookOptions {
  /** Secret: whoever has it can post to the channel. Never log it. */
  readonly webhookUrl: string;
  /** The public site, for links and avatars. */
  readonly siteUrl: string;
  readonly locale: ContentLocale;
  readonly fetch?: typeof fetch;
}

function embed(
  celebration: Celebration,
  { siteUrl, locale }: Pick<DiscordWebhookOptions, "siteUrl" | "locale">,
) {
  const { member } = celebration;
  const page = new URL(`/characters/${member.slug}`, siteUrl).href;
  const avatar = new URL(`/api/characters/${member.slug}/avatar`, siteUrl).href;
  const { title, description } = celebrationText(celebration, locale);
  return {
    author: { name: member.name, url: page, icon_url: avatar },
    title,
    description,
    url: page,
    color: CLASS_COLORS[member.classId] ?? FALLBACK_COLOR,
    thumbnail: { url: thumbnailOf(celebration, siteUrl) ?? avatar },
  };
}

/** An achievement shows its own icon; everything else the member. */
function thumbnailOf(
  celebration: Celebration,
  siteUrl: string,
): string | undefined {
  return celebration.kind === "achievement" && celebration.iconUrl !== undefined
    ? new URL(celebration.iconUrl, siteUrl).href
    : undefined;
}

export function makeDiscordWebhookNotifier(
  options: DiscordWebhookOptions,
): CelebrationNotifier {
  const send = options.fetch ?? fetch;
  return {
    batchSize: EMBEDS_PER_MESSAGE,
    async announce(celebrations) {
      const response = await send(options.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: celebrations.map((celebration) =>
            embed(celebration, options),
          ),
        }),
      });
      if (!response.ok)
        throw new Error(`Discord webhook answered ${String(response.status)}`);
    },
  };
}
