import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import { wowForever } from "@blizzard-api/wow-forever";
import { mapLimited } from "../../../platform/kernel/map-limited.js";
import { sendCharacterRequest } from "./battle-net-request.js";
import type { QuestInfo } from "./map-character-profile.js";

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
        if (result.ok)
          cache.set(cacheKey(locale, id), mapQuestDocument(result.value));
        else if (result.error.code === "character.not_found")
          cache.set(cacheKey(locale, id), null);
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
    ...text("description", record.description),
    ...text("area", rec(record.area).name),
    ...text("category", rec(record.category).name),
    ...optionalCadence(record),
    ...numberField("minLevel", requirements.min_character_level),
    ...numberField("experience", rewards.experience),
    ...numberField("moneyCopper", rec(rewards.money).value),
    ...(items.length === 0 ? {} : { itemRewards: items }),
  };
}

export function questIdsInProgress(quests: unknown): number[] {
  const list = rec(quests).in_progress;
  if (!Array.isArray(list)) return [];
  const ids = new Set<number>();
  for (const entry of list) {
    const id = rec(entry).id;
    if (typeof id === "number" && id > 0) ids.add(id);
  }
  return [...ids];
}

function optionalCadence(
  record: Record<string, unknown>,
): Pick<QuestInfo, "cadence"> | Record<string, never> {
  if (record.is_daily === true) return { cadence: "daily" };
  if (record.is_weekly === true) return { cadence: "weekly" };
  if (record.is_repeatable === true) return { cadence: "repeatable" };
  return {};
}

function namedItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const label = rec(rec(entry).item).name;
    return typeof label === "string" && label.length > 0 ? [label] : [];
  });
}

function text<K extends "description" | "area" | "category">(
  key: K,
  value: unknown,
): Partial<Pick<QuestInfo, K>> {
  return typeof value === "string" && value.length > 0
    ? ({ [key]: value } as Pick<QuestInfo, K>)
    : {};
}

function numberField<K extends "minLevel" | "experience" | "moneyCopper">(
  key: K,
  value: unknown,
): Partial<Pick<QuestInfo, K>> {
  return typeof value === "number" && value >= 0
    ? ({ [key]: Math.trunc(value) } as Pick<QuestInfo, K>)
    : {};
}

function cacheKey(locale: ContentLocale, id: number): string {
  return `${locale}:${String(id)}`;
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
