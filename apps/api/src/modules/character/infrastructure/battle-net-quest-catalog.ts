import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import { wowForever } from "@blizzard-api/wow-forever";
import {
  int,
  list,
  name,
  optional,
  positiveInt,
  rec,
  str,
} from "../../../platform/blizzard/document.js";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { sendCharacterRequest } from "./battle-net-request.js";
import type { QuestInfo } from "./map-quest-log.js";

const LOOKUP_CONCURRENCY = 6;

/** Static quest text, keyed by locale and id for the life of the process. */
export function makeBattleNetQuestCatalog(client: BlizzardApiClient) {
  const cache = new Map<string, QuestInfo | null>();
  return {
    async lookup(
      ids: readonly number[],
      locale: ContentLocale,
    ): Promise<ReadonlyMap<number, QuestInfo>> {
      const missing = ids.filter((id) => !cache.has(cacheKey(locale, id)));
      await mapLimited(missing, LOOKUP_CONCURRENCY, async (id) => {
        const result = await sendCharacterRequest(
          client,
          wowForever.quest(id),
          locale,
        );
        if (!result.ok && result.error.code !== "character.not_found") return;
        cache.set(
          cacheKey(locale, id),
          result.ok ? mapQuestDocument(result.value) : null,
        );
      });
      const facts = new Map<number, QuestInfo>();
      for (const id of ids) {
        const info = cache.get(cacheKey(locale, id));
        if (info) facts.set(id, info);
      }
      return facts;
    },
  };
}

export function mapQuestDocument(value: unknown): QuestInfo {
  const record = rec(value);
  const rewards = rec(record.rewards);
  const requirements = rec(record.requirements);
  const items = [
    ...namedItems(rec(rewards.items).items),
    ...namedItems(rec(rewards.items).choice_of),
  ];
  return {
    ...optional("description", str(record.description)),
    ...optional("area", name(record.area)),
    ...optional("areaId", positiveInt(rec(record.area).id)),
    ...optional("category", name(record.category)),
    ...optional("cadence", cadenceOf(record)),
    ...optional("minLevel", amount(requirements.min_character_level)),
    ...optional("experience", amount(rewards.experience)),
    ...optional("moneyCopper", amount(rec(rewards.money).value)),
    ...(items.length === 0 ? {} : { itemRewards: items }),
  };
}

export function questIdsInProgress(quests: unknown): number[] {
  const ids = list(rec(quests).in_progress).flatMap((entry) => {
    const id = positiveInt(rec(entry).id);
    return id === undefined ? [] : [id];
  });
  return [...new Set(ids)];
}

const cadenceFlags = [
  ["is_daily", "daily"],
  ["is_weekly", "weekly"],
  ["is_repeatable", "repeatable"],
] as const;

function cadenceOf(record: Record<string, unknown>): QuestInfo["cadence"] {
  return cadenceFlags.find(([flag]) => record[flag] === true)?.[1];
}

function namedItems(value: unknown): string[] {
  return list(value).flatMap((entry) => {
    const label = name(rec(entry).item);
    return label === undefined ? [] : [label];
  });
}

function amount(value: unknown): number | undefined {
  const whole = int(value);
  return whole !== undefined && whole >= 0 ? whole : undefined;
}

function cacheKey(locale: ContentLocale, id: number): string {
  return `${locale}:${String(id)}`;
}
