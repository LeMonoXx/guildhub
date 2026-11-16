import type { BlizzardApiClient } from "@blizzard-api/client";
import type { ContentLocale } from "@guildhub/contracts";
import { ok } from "../../../platform/kernel/result.js";
import type { CharacterProfileSource } from "../application/ports.js";
import { BattleNetAchievementCatalog } from "./battle-net-achievement-catalog.js";
import { makeItemIcons } from "./battle-net-item-icons.js";
import { fetchProfileDocuments } from "./battle-net-profile-documents.js";
import {
  makeBattleNetQuestCatalog,
  questIdsInProgress,
} from "./battle-net-quest-catalog.js";
import { BattleNetTalentTreeCatalog } from "./battle-net-talent-tree-catalog.js";
import { mapCharacterProfile } from "./map-character-profile.js";
import { mapTalentTrees } from "./map-talent-trees.js";
import {
  achievementIds,
  classIdOf,
  hasAvatar,
  mediaIds,
} from "./profile-document-ids.js";

interface LocaleCatalogs {
  readonly achievements: BattleNetAchievementCatalog;
  readonly talents: BattleNetTalentTreeCatalog;
}

/** Reads a character's profile documents and enriches them from static game data. */
export function makeBattleNetCharacterProfileSource(
  client: BlizzardApiClient,
  publicPaths: {
    icon: (iconId: number) => string;
    avatar: (slug: string) => string;
  },
): CharacterProfileSource {
  const itemIcons = makeItemIcons(client);
  const quests = makeBattleNetQuestCatalog(client);
  const catalogs = new Map<ContentLocale, LocaleCatalogs>();
  const catalogsFor = (locale: ContentLocale): LocaleCatalogs => {
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
      const documents = await fetchProfileDocuments(client, character, locale);
      if (!documents.ok) return documents;
      const raw = documents.value;
      const { achievements, talents } = catalogsFor(locale);
      const [icons, achievementInfo, talentLayouts, questInfo] =
        await Promise.all([
          itemIcons(mediaIds(raw.equipment)),
          achievements.lookup(achievementIds(raw.achievements)),
          talents.forClass(classIdOf(raw.summary)),
          quests.lookup(questIdsInProgress(raw.quests), locale),
        ]);
      const profile = mapCharacterProfile({
        raw,
        fallbackLevel: 1,
        iconUrl: publicPaths.icon,
        itemIcons: icons,
        achievementInfo,
        questInfo,
        avatarUrl: hasAvatar(raw.media)
          ? publicPaths.avatar(character.slug)
          : undefined,
      });
      if (talentLayouts.length === 0) return ok(profile);
      return ok({
        ...profile,
        talentTrees: mapTalentTrees(
          talentLayouts,
          raw.specializations,
          publicPaths.icon,
        ),
      });
    },
  };
}
