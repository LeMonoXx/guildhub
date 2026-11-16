import type {
  AchievementRef,
  EquippedItem,
  ItemQuality,
  ItemStat,
  Profession,
  QuestLogEntry,
  QuestRef,
  StatisticGroup,
} from "@guildhub/contracts";
import type { CharacterProfileData } from "../domain/profile.js";
import type { AchievementInfo } from "./battle-net-achievement-catalog.js";

export interface RawCharacterProfile {
  readonly summary?: unknown;
  readonly equipment?: unknown;
  readonly statistics?: unknown;
  readonly specializations?: unknown;
  readonly professions?: unknown;
  readonly reputations?: unknown;
  readonly titles?: unknown;
  readonly pvp?: unknown;
  readonly achievements?: unknown;
  readonly achievementStatistics?: unknown;
  readonly mounts?: unknown;
  readonly pets?: unknown;
  readonly toys?: unknown;
  readonly heirlooms?: unknown;
  readonly hunterPets?: unknown;
  readonly quests?: unknown;
  readonly completedQuests?: unknown;
}

const QUALITIES: readonly ItemQuality[] = [
  "POOR",
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "ARTIFACT",
  "HEIRLOOM",
];
const PRIMARY_STATS = ["strength", "agility", "stamina", "intellect", "spirit"];
const RESISTANCES = ["fire", "nature", "frost", "shadow", "arcane"];
const RECENT_QUEST_LIMIT = 12;

export function mapCharacterProfile(input: {
  raw: RawCharacterProfile;
  fallbackLevel: number;
  iconUrl: (iconId: number) => string;
  itemIcons: ReadonlyMap<number, number>;
  achievementInfo?: ReadonlyMap<number, AchievementInfo>;
  questInfo?: ReadonlyMap<number, QuestInfo>;
  avatarUrl?: string;
}): CharacterProfileData {
  const { raw } = input;
  const describeAchievement = (id: number, label: string): AchievementRef => {
    const info = input.achievementInfo?.get(id);
    return {
      id,
      name: label,
      ...optional(
        "iconUrl",
        info?.iconId === undefined ? undefined : input.iconUrl(info.iconId),
      ),
      ...optional("details", info?.details),
    };
  };
  const summary = rec(raw.summary);
  const achievements = rec(raw.achievements);
  const titles = rec(raw.titles);
  const pvp = rec(raw.pvp);
  return {
    summary: {
      level: int(summary.level) ?? input.fallbackLevel,
      ...optional("experience", int(summary.experience)),
      ...optional("gender", name(summary.gender)),
      ...optional("faction", name(summary.faction)),
      ...optional("race", name(summary.race)),
      ...optional("className", name(summary.character_class)),
      ...optional("guild", name(summary.guild)),
      ...optional("lastLoginAt", isoFromMillis(summary.last_login_timestamp)),
      ...optional("averageItemLevel", num(summary.average_item_level)),
      ...optional("equippedItemLevel", num(summary.equipped_item_level)),
      achievementPoints: int(summary.achievement_points) ?? 0,
      ...optional("activeTitle", titleOf(summary.active_title)),
      ...optional("ruleset", name(summary.ruleset)),
    },
    ...optional("statistics", mapStatistics(raw.statistics)),
    equipment: list(rec(raw.equipment).equipped_items).flatMap((item) => {
      const mapped = mapItem(item, input.iconUrl, input.itemIcons);
      return mapped === undefined ? [] : [mapped];
    }),
    specializations: mapSpecializations(raw.specializations),
    professions: [
      ...mapProfessions(rec(raw.professions).primaries, "primary"),
      ...mapProfessions(rec(raw.professions).secondaries, "secondary"),
    ],
    reputations: list(rec(raw.reputations).reputations).flatMap((entry) => {
      const record = rec(entry);
      const faction = rec(record.faction);
      const standing = rec(record.standing);
      const factionId = int(faction.id);
      const factionName = str(faction.name);
      const standingName = str(standing.name);
      if (factionId === undefined || !factionName || !standingName) return [];
      return [
        {
          factionId,
          faction: factionName,
          standing: standingName,
          tier: int(standing.tier) ?? 0,
          value: int(standing.value) ?? 0,
          max: Math.max(0, int(standing.max) ?? 0),
        },
      ];
    }),
    titles: list(titles.titles).flatMap((title) => {
      const value = titleOf(title);
      return value === undefined ? [] : [value];
    }),
    ...optional(
      "pvp",
      raw.pvp === undefined
        ? undefined
        : {
            honorableKills: Math.max(0, int(pvp.honorable_kills) ?? 0),
            rank: Math.max(0, int(pvp.pvp_rank) ?? 0),
          },
    ),
    achievements: {
      total: Math.max(0, int(achievements.total_quantity) ?? 0),
      points: Math.max(0, int(achievements.total_points) ?? 0),
      recent: list(achievements.recent_events).flatMap((event) => {
        const record = rec(event);
        const achievement = rec(record.achievement);
        const id = int(achievement.id);
        const label = str(achievement.name);
        const at = isoFromMillis(record.timestamp);
        if (id === undefined || !label || at === undefined) return [];
        return [{ ...describeAchievement(id, label), at }];
      }),
      categories: list(achievements.category_progress).flatMap((entry) => {
        const record = rec(entry);
        const label = name(record.category);
        if (!label) return [];
        return [
          {
            name: label,
            quantity: Math.max(0, int(record.quantity) ?? 0),
            points: Math.max(0, int(record.points) ?? 0),
          },
        ];
      }),
      inProgress: list(achievements.achievements).flatMap((entry) => {
        const record = rec(entry);
        const achievement = rec(record.achievement);
        const id = int(achievement.id);
        const label = str(achievement.name);
        if (id === undefined || !label) return [];
        if (rec(record.criteria).is_completed === true) return [];
        if (record.completed_timestamp !== undefined) return [];
        return [describeAchievement(id, label)];
      }),
    },
    statisticGroups: mapStatisticGroups(raw.achievementStatistics),
    collections: {
      mounts: names(list(rec(raw.mounts).mounts).map((m) => rec(m).mount)),
      pets: list(rec(raw.pets).pets).flatMap((entry) => {
        const record = rec(entry);
        const label = name(record.species);
        if (!label) return [];
        return [
          {
            name: str(record.name) ?? label,
            level: Math.max(0, int(record.level) ?? 0),
            ...optional("quality", quality(record.quality)),
          },
        ];
      }),
      toys: names(list(rec(raw.toys).toys).map((t) => rec(t).toy)),
      heirlooms: names(
        list(rec(raw.heirlooms).heirlooms).map((h) => rec(h).heirloom),
      ),
    },
    hunterPets: list(rec(raw.hunterPets).hunter_pets).flatMap((entry) => {
      const record = rec(entry);
      const label = str(record.name);
      if (!label) return [];
      return [
        {
          name: label,
          level: Math.max(0, int(record.level) ?? 0),
          ...optional("creature", name(record.creature)),
          active: record.is_active === true,
        },
      ];
    }),
    quests: {
      inProgress: questRefs(list(rec(raw.quests).in_progress)).map((quest) =>
        withQuestInfo(quest, input.questInfo?.get(quest.id)),
      ),
      completedCount: list(rec(raw.completedQuests).quests).length,
      recentCompleted: questRefs(list(rec(raw.completedQuests).quests)).slice(
        0,
        RECENT_QUEST_LIMIT,
      ),
    },
    ...optional("avatarUrl", input.avatarUrl),
  };
}

function mapItem(
  value: unknown,
  iconUrl: (iconId: number) => string,
  itemIcons: ReadonlyMap<number, number>,
): EquippedItem | undefined {
  const record = rec(value);
  const itemId = int(rec(record.item).id);
  const slot = rec(record.slot);
  const slotType = str(slot.type);
  const label = str(record.name);
  const itemQuality = quality(record.quality);
  if (itemId === undefined || !slotType || !label || !itemQuality) {
    return undefined;
  }
  const mediaId = int(rec(record.media).id) ?? itemId;
  const iconId = itemIcons.get(mediaId);
  const weapon = rec(record.weapon);
  const damage = rec(weapon.damage);
  const speed = rec(weapon.attack_speed);
  const dps = rec(weapon.dps);
  const durability = rec(record.durability);
  const durabilityMax = /\/\s*(\d+)/.exec(str(durability.display_string) ?? "");
  const sell = int(rec(record.sell_price).value);
  return {
    slot: slotType,
    slotName: str(slot.name) ?? slotType,
    itemId,
    name: label,
    quality: itemQuality,
    qualityName: name(record.quality) ?? itemQuality,
    ...optional("iconUrl", iconId === undefined ? undefined : iconUrl(iconId)),
    ...optional("itemLevel", int(rec(record.level).value)),
    ...optional(
      "requiredLevel",
      int(rec(rec(record.requirements).level).value),
    ),
    ...optional("binding", name(record.binding)),
    ...optional("itemClass", name(record.item_class)),
    ...optional(
      "itemSubclass",
      record.is_subclass_hidden === true
        ? undefined
        : name(record.item_subclass),
    ),
    ...optional("inventoryType", name(record.inventory_type)),
    ...optional("armor", displayString(record.armor)),
    ...optional("shieldBlock", displayString(record.shield_block)),
    ...optional(
      "weapon",
      str(damage.display_string) === undefined
        ? undefined
        : {
            damage: str(damage.display_string) ?? "",
            ...optional("damageClass", name(damage.damage_class)),
            minDamage: num(damage.min_value) ?? 0,
            maxDamage: num(damage.max_value) ?? 0,
            ...optional("speed", str(speed.display_string)),
            speedSeconds: (num(speed.value) ?? 0) / 1000,
            ...optional("dps", str(dps.display_string)),
            dpsValue: num(dps.value) ?? 0,
          },
    ),
    stats: list(record.stats).flatMap((entry): ItemStat[] => {
      const stat = rec(entry);
      const display = rec(stat.display);
      const type = str(rec(stat.type).type);
      const statLabel = str(display.display_string);
      if (!type || !statLabel) return [];
      return [
        {
          type,
          label: statLabel,
          value: num(stat.value) ?? 0,
          equipBonus: stat.is_equip_bonus === true,
          ...optional("color", hexColor(display.color)),
        },
      ];
    }),
    enchantments: list(record.enchantments).flatMap((entry) => {
      const text = str(rec(entry).display_string);
      return text ? [text] : [];
    }),
    ...optional(
      "durability",
      int(durability.value) === undefined
        ? undefined
        : {
            current: Math.max(0, int(durability.value) ?? 0),
            max: Math.max(0, Number(durabilityMax?.[1] ?? 0)),
          },
    ),
    ...optional("sellPriceCopper", sell === undefined ? undefined : sell),
    ...optional("description", str(record.description)),
    quantity: Math.max(1, int(record.quantity) ?? 1),
  };
}

function mapStatistics(value: unknown): CharacterProfileData["statistics"] {
  if (value === undefined) return undefined;
  const s = rec(value);
  const pair = (entry: unknown) => {
    const record = rec(entry);
    const base = num(record.base);
    const effective = num(record.effective);
    return base === undefined || effective === undefined
      ? undefined
      : { base, effective };
  };
  const rating = (entry: unknown) => num(rec(entry).value) ?? 0;
  const hand = (prefix: string) => {
    const min = num(s[`${prefix}_damage_min`]) ?? 0;
    const max = num(s[`${prefix}_damage_max`]) ?? 0;
    if (max <= 0) return undefined;
    return {
      min,
      max,
      speed: num(s[`${prefix}_speed`]) ?? 0,
      dps: num(s[`${prefix}_dps`]) ?? 0,
    };
  };
  return {
    health: num(s.health) ?? 0,
    power: num(s.power) ?? 0,
    ...optional("powerType", name(s.power_type)),
    primary: PRIMARY_STATS.flatMap((type) => {
      const entry = pair(s[type]);
      return entry === undefined ? [] : [{ type, ...entry }];
    }),
    ...optional("armor", pair(s.armor)),
    ...optional("defense", pair(s.defense)),
    resistances: RESISTANCES.flatMap((school) => {
      const entry = pair(s[`${school}_resistance`]);
      return entry === undefined ? [] : [{ school, ...entry }];
    }),
    melee: {
      attackPower: num(s.attack_power) ?? 0,
      crit: rating(s.melee_crit),
      hit: rating(s.melee_hit),
      ...optional("mainHand", hand("main_hand")),
      ...optional("offHand", hand("off_hand")),
    },
    ranged: {
      attackPower: num(s.ranged_attack_power) ?? 0,
      crit: rating(s.ranged_crit),
      hit: rating(s.ranged_hit),
      min: num(s.ranged_damage_min) ?? 0,
      max: num(s.ranged_damage_max) ?? 0,
    },
    spell: {
      power: num(s.spell_power) ?? 0,
      healing: num(s.spell_healing) ?? 0,
      crit: rating(s.spell_crit),
      hit: rating(s.spell_hit),
      penetration: num(s.spell_penetration) ?? 0,
      manaRegen: num(s.mana_regen) ?? 0,
      manaRegenCombat: num(s.mana_regen_combat) ?? 0,
    },
    defenses: {
      dodge: rating(s.dodge),
      parry: rating(s.parry),
      block: rating(s.block),
    },
    ...optional("movementSpeed", num(s.movement_speed)),
  };
}

function mapSpecializations(
  value: unknown,
): CharacterProfileData["specializations"] {
  const groups = list(rec(value).specialization_groups);
  const active =
    groups.find((group) => rec(group).is_active === true) ?? groups[0];
  return list(rec(active).specializations).flatMap((entry) => {
    const record = rec(entry);
    const spec = rec(record.specialization);
    const id = int(spec.id);
    const label = str(record.specialization_name) ?? str(spec.name);
    if (id === undefined || !label) return [];
    return [
      {
        id,
        name: label,
        spentPoints: Math.max(0, int(record.spent_points) ?? 0),
        talents: list(record.talents).flatMap((talent) => {
          const t = rec(talent);
          const tooltip = rec(t.spell_tooltip);
          const talentName = name(t.talent) ?? name(tooltip.spell);
          if (!talentName) return [];
          return [
            {
              name: talentName,
              rank: Math.max(0, int(t.talent_rank) ?? 0),
              ...optional("description", str(tooltip.description)),
              ...optional("castTime", str(tooltip.cast_time)),
              ...optional("spellId", int(rec(tooltip.spell).id)),
            },
          ];
        }),
      },
    ];
  });
}

function mapProfessions(
  value: unknown,
  kind: Profession["kind"],
): Profession[] {
  return list(value).flatMap((entry) => {
    const record = rec(entry);
    const profession = rec(record.profession);
    const id = int(profession.id);
    const label = str(profession.name);
    if (id === undefined || !label) return [];
    const tiers = list(record.tiers).map(rec);
    const best = tiers.reduce<Record<string, unknown> | undefined>(
      (top, tier) =>
        top === undefined ||
        (int(tier.max_skill_points) ?? 0) > (int(top.max_skill_points) ?? 0)
          ? tier
          : top,
      undefined,
    );
    return [
      {
        id,
        name: label,
        kind,
        skill: Math.max(
          0,
          int(best?.skill_points) ?? int(record.skill_points) ?? 0,
        ),
        maxSkill: Math.max(
          0,
          int(best?.max_skill_points) ?? int(record.max_skill_points) ?? 0,
        ),
        recipes: names(tiers.flatMap((tier) => list(tier.known_recipes))),
        recipeIds: [
          ...new Set(
            tiers
              .flatMap((tier) => list(tier.known_recipes))
              .flatMap((recipe) => {
                const recipeId = int(rec(recipe).id);
                return recipeId === undefined ? [] : [recipeId];
              }),
          ),
        ],
      },
    ];
  });
}

function mapStatisticGroups(value: unknown): StatisticGroup[] {
  const groups: StatisticGroup[] = [];
  const push = (id: unknown, label: unknown, statistics: unknown) => {
    const groupId = int(id);
    const groupName = str(label);
    const entries = list(statistics).flatMap((entry) => {
      const record = rec(entry);
      const entryName = str(record.name);
      const quantity = num(record.quantity);
      if (!entryName || quantity === undefined) return [];
      return [
        {
          name: entryName,
          quantity,
          ...optional("detail", str(record.description)),
          ...optional("at", isoFromMillis(record.last_updated_timestamp)),
        },
      ];
    });
    if (groupId === undefined || !groupName || entries.length === 0) return;
    groups.push({ id: groupId, name: groupName, entries });
  };
  for (const category of list(rec(value).categories)) {
    const record = rec(category);
    push(record.id, record.name, record.statistics);
    for (const sub of list(record.sub_categories)) {
      const subRecord = rec(sub);
      push(subRecord.id, subRecord.name, subRecord.statistics);
    }
  }
  return groups;
}

function titleOf(value: unknown): string | undefined {
  const record = rec(value);
  const label = str(record.name);
  const template = str(record.display_string);
  return template ?? label;
}

function quality(value: unknown): ItemQuality | undefined {
  const type = str(rec(value).type);
  return QUALITIES.find((entry) => entry === type);
}

function displayString(value: unknown): string | undefined {
  return str(rec(rec(value).display).display_string);
}

function hexColor(value: unknown): string | undefined {
  const color = rec(value);
  const channels = [color.r, color.g, color.b].map((c) => int(c));
  if (channels.some((c) => c === undefined)) return undefined;
  return `#${channels
    .map((c) =>
      Math.min(255, Math.max(0, c ?? 0))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function isoFromMillis(value: unknown): string | undefined {
  const millis = num(value);
  if (millis === undefined || millis <= 0) return undefined;
  return new Date(millis).toISOString();
}

export interface QuestInfo {
  readonly description?: string;
  readonly area?: string;
  readonly category?: string;
  readonly cadence?: QuestLogEntry["cadence"];
  readonly minLevel?: number;
  readonly experience?: number;
  readonly moneyCopper?: number;
  readonly itemRewards?: readonly string[];
}

function questRefs(values: readonly unknown[]): QuestRef[] {
  const seen = new Set<number>();
  return values.flatMap((value) => {
    const record = rec(value);
    const id = int(record.id);
    const label = str(record.name);
    if (id === undefined || id <= 0 || label === undefined || seen.has(id))
      return [];
    seen.add(id);
    return [{ id, name: label }];
  });
}

function withQuestInfo(
  quest: QuestRef,
  info: QuestInfo | undefined,
): QuestLogEntry {
  if (info === undefined) return quest;
  return {
    ...quest,
    ...optional("description", info.description),
    ...optional("area", info.area),
    ...optional("category", info.category),
    ...optional("cadence", info.cadence),
    ...optional("minLevel", info.minLevel),
    ...optional("experience", info.experience),
    ...optional("moneyCopper", info.moneyCopper),
    ...(info.itemRewards === undefined || info.itemRewards.length === 0
      ? {}
      : { itemRewards: info.itemRewards }),
  };
}

function names(values: readonly unknown[]): string[] {
  return values.flatMap((value) => {
    const label = name(value);
    return label ? [label] : [];
  });
}

function name(value: unknown): string | undefined {
  return str(rec(value).name);
}

function optional<K extends string, V>(
  key: K,
  value: V | undefined,
): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function int(value: unknown): number | undefined {
  const n = num(value);
  return n === undefined ? undefined : Math.trunc(n);
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
