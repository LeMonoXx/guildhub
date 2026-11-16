import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok } from "../../../platform/kernel/result.js";
import type { CharacterProfileSource } from "../application/ports.js";
import {
  forCharacter,
  mapLimited,
  sendBattleNet,
  sendBattleNetPatiently,
  type BattleNetResource,
} from "./battle-net-request.js";
import {
  mapCharacterProfile,
  type RawCharacterProfile,
} from "./map-character-profile.js";
import { BattleNetAchievementCatalog } from "./battle-net-achievement-catalog.js";
import { BattleNetTalentTreeCatalog } from "./battle-net-talent-tree-catalog.js";
import { mapTalentTrees } from "./map-talent-trees.js";
import {
  characterProfileEndpoints,
  itemMediaEndpoint,
} from "./wow-forever-character.js";

const REQUEST_CONCURRENCY = 6;
const PROFILE_ATTEMPTS = 3;

export function makeBattleNetCharacterProfileSource(
  client: BlizzardApiClient,
  publicPaths: {
    icon: (iconId: number) => string;
    avatar: (slug: string) => string;
  },
): CharacterProfileSource {
  // Item media is static game data, so icon ids stay valid for the process.
  const iconIds = new Map<number, number | undefined>();
  const catalogs = new Map<
    ContentLocale,
    {
      achievements: BattleNetAchievementCatalog;
      talents: BattleNetTalentTreeCatalog;
    }
  >();
  const catalogsFor = (locale: ContentLocale) => {
    const known = catalogs.get(locale);
    if (known) return known;
    const created = {
      achievements: new BattleNetAchievementCatalog(client, locale),
      talents: new BattleNetTalentTreeCatalog(client, locale),
    };
    catalogs.set(locale, created);
    return created;
  };
  return {
    fetchProfile: async (character, locale) => {
      const { achievements: achievementCatalog, talents: talentCatalog } =
        catalogsFor(locale);
      const endpoints = characterProfileEndpoints(
        character.name,
        character.surname,
      );
      const entries = Object.entries(endpoints) as [
        keyof typeof endpoints,
        BattleNetResource,
      ][];
      const results = await mapLimited(
        entries,
        REQUEST_CONCURRENCY,
        async ([key, resource]) =>
          [
            key,
            forCharacter(
              await sendBattleNetPatiently(client, resource, {
                locale,
                attempts: PROFILE_ATTEMPTS,
              }),
              character.characterId,
            ),
          ] as const,
      );
      const byKey = new Map(results);
      const summary = byKey.get("summary");
      if (summary === undefined) return err(appError("character.not_found"));
      if (!summary.ok) return summary;
      // A document that did not answer would read as "nothing there" and
      // overwrite the last good profile; failing keeps that one instead.
      for (const result of byKey.values()) {
        if (!result.ok && result.error.code !== "character.not_found")
          return result;
      }
      const raw: Record<string, unknown> = {};
      for (const [key, result] of byKey) {
        if (result.ok) raw[key] = result.value;
      }
      const [, achievementInfo, talentLayouts] = await Promise.all([
        loadIcons(client, iconIds, mediaIds(raw.equipment)),
        achievementCatalog.lookup(achievementIds(raw.achievements)),
        talentCatalog.forClass(classIdOf(raw.summary)),
      ]);
      const profile = mapCharacterProfile({
        raw: raw satisfies RawCharacterProfile,
        fallbackLevel: 1,
        iconUrl: publicPaths.icon,
        itemIcons: knownIcons(iconIds),
        achievementInfo,
        avatarUrl: hasAvatar(raw.media)
          ? publicPaths.avatar(character.slug)
          : undefined,
      });
      return ok(
        talentLayouts.length === 0
          ? profile
          : {
              ...profile,
              talentTrees: mapTalentTrees(
                talentLayouts,
                raw.specializations,
                publicPaths.icon,
              ),
            },
      );
    },
  };
}

async function loadIcons(
  client: BlizzardApiClient,
  cache: Map<number, number | undefined>,
  ids: readonly number[],
): Promise<void> {
  const missing = ids.filter((id) => !cache.has(id));
  await mapLimited(missing, REQUEST_CONCURRENCY, async (id) => {
    const media = await sendBattleNet(client, itemMediaEndpoint(id));
    if (media.ok) cache.set(id, iconIdOf(media.value));
    else if (media.error.code === "character.not_found")
      cache.set(id, undefined);
  });
}

function knownIcons(
  cache: ReadonlyMap<number, number | undefined>,
): Map<number, number> {
  const known = new Map<number, number>();
  for (const [mediaId, iconId] of cache) {
    if (iconId !== undefined) known.set(mediaId, iconId);
  }
  return known;
}

/** Ids of recent and listed achievements, the ones the site shows. */
function achievementIds(achievements: unknown): number[] {
  const record = asRecord(achievements);
  const entries = [record.recent_events, record.achievements].flatMap((list) =>
    Array.isArray(list) ? (list as unknown[]) : [],
  );
  const ids = new Set<number>();
  for (const entry of entries) {
    const id = asRecord(asRecord(entry).achievement).id;
    if (typeof id === "number" && id > 0) ids.add(id);
  }
  return [...ids];
}

function classIdOf(summary: unknown): number {
  const id = asRecord(asRecord(summary).character_class).id;
  return typeof id === "number" ? id : 0;
}

function mediaIds(equipment: unknown): number[] {
  const items = asRecord(equipment).equipped_items;
  if (!Array.isArray(items)) return [];
  const ids = new Set<number>();
  for (const item of items) {
    const record = asRecord(item);
    const id = asRecord(record.media).id ?? asRecord(record.item).id;
    if (typeof id === "number" && id > 0) ids.add(id);
  }
  return [...ids];
}

function iconIdOf(media: unknown): number | undefined {
  const assets = asRecord(media).assets;
  if (!Array.isArray(assets)) return undefined;
  for (const asset of assets) {
    const record = asRecord(asset);
    if (record.key === "icon" && typeof record.file_data_id === "number") {
      return record.file_data_id;
    }
  }
  return undefined;
}

function avatarAssetUrl(media: unknown): string | undefined {
  const assets = asRecord(media).assets;
  if (!Array.isArray(assets)) return undefined;
  for (const asset of assets) {
    const record = asRecord(asset);
    if (record.key === "avatar" && typeof record.value === "string") {
      return record.value;
    }
  }
  return undefined;
}

function hasAvatar(media: unknown): boolean {
  return avatarAssetUrl(media) !== undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
