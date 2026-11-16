import { describe, expect, it } from "vitest";
import { mapCharacterProfile } from "./map-character-profile.js";

const color = { r: 0, g: 255, b: 0, a: 1 };

describe("mapCharacterProfile", () => {
  it("maps a full equipment tooltip with icon, weapon, stats, and enchant", () => {
    const profile = mapCharacterProfile({
      fallbackLevel: 1,
      iconUrl: (id) => `/api/icons/${String(id)}`,
      itemIcons: new Map([[15445, 133060]]),
      raw: {
        summary: {
          level: 21,
          last_login_timestamp: 1794608194000,
          equipped_item_level: 12,
          achievement_points: 5,
          character_class: { name: "Warrior" },
        },
        equipment: {
          equipped_items: [
            {
              item: { id: 15445 },
              media: { id: 15445 },
              slot: { type: "MAIN_HAND", name: "Main Hand" },
              quantity: 1,
              quality: { type: "RARE", name: "Rare" },
              name: "Example Hammer",
              item_class: { name: "Weapon" },
              item_subclass: { name: "Mace" },
              inventory_type: { name: "Main Hand" },
              binding: { name: "Binds when picked up" },
              weapon: {
                damage: {
                  min_value: 25,
                  max_value: 47,
                  display_string: "25 - 47 Damage",
                  damage_class: { name: "Physical" },
                },
                attack_speed: { value: 2900, display_string: "Speed 2.90" },
                dps: {
                  value: 12.4,
                  display_string: "(12.4 damage per second)",
                },
              },
              stats: [
                {
                  type: { type: "SPIRIT" },
                  value: 3,
                  is_equip_bonus: true,
                  display: { display_string: "+3 Spirit", color },
                },
              ],
              enchantments: [{ display_string: "Enchanted: Defense +3" }],
              sell_price: { value: 1291 },
              requirements: { level: { value: 17 } },
              level: { value: 18 },
              durability: { value: 37, display_string: "Durability 37 / 65" },
              description: "For a friend",
            },
          ],
        },
      },
    });
    expect(profile.summary).toMatchObject({
      level: 21,
      className: "Warrior",
      equippedItemLevel: 12,
      lastLoginAt: "2026-11-13T22:16:34.000Z",
    });
    expect(profile.equipment[0]).toEqual({
      slot: "MAIN_HAND",
      slotName: "Main Hand",
      itemId: 15445,
      name: "Example Hammer",
      quality: "RARE",
      qualityName: "Rare",
      iconUrl: "/api/icons/133060",
      itemLevel: 18,
      requiredLevel: 17,
      binding: "Binds when picked up",
      itemClass: "Weapon",
      itemSubclass: "Mace",
      inventoryType: "Main Hand",
      weapon: {
        damage: "25 - 47 Damage",
        damageClass: "Physical",
        minDamage: 25,
        maxDamage: 47,
        speed: "Speed 2.90",
        speedSeconds: 2.9,
        dps: "(12.4 damage per second)",
        dpsValue: 12.4,
      },
      stats: [
        {
          type: "SPIRIT",
          label: "+3 Spirit",
          value: 3,
          equipBonus: true,
          color: "#00ff00",
        },
      ],
      enchantments: ["Enchanted: Defense +3"],
      durability: { current: 37, max: 65 },
      sellPriceCopper: 1291,
      description: "For a friend",
      quantity: 1,
    });
  });

  it("gives recent achievements their icon and details when known", () => {
    const details = {
      description: "Reach 150 skill in Alchemy for the first time.",
      category: "Alchemy",
    };
    const profile = mapCharacterProfile({
      fallbackLevel: 1,
      iconUrl: (id) => `/api/icons/${String(id)}`,
      itemIcons: new Map(),
      achievementInfo: new Map([[62012, { iconId: 136240, details }]]),
      raw: {
        achievements: {
          recent_events: [
            {
              achievement: { id: 62012, name: "Journeyman Alchemist" },
              timestamp: 1794609480000,
            },
            {
              achievement: { id: 61994, name: "Novice Mage" },
              timestamp: 1794609000000,
            },
          ],
        },
      },
    });
    expect(profile.achievements.recent).toEqual([
      {
        id: 62012,
        name: "Journeyman Alchemist",
        at: "2026-11-13T22:38:00.000Z",
        iconUrl: "/api/icons/136240",
        details,
      },
      { id: 61994, name: "Novice Mage", at: "2026-11-13T22:30:00.000Z" },
    ]);
  });

  it("drops blank weapon speed and dps texts instead of failing the profile", () => {
    const profile = mapCharacterProfile({
      fallbackLevel: 1,
      iconUrl: (id) => `/api/icons/${String(id)}`,
      itemIcons: new Map(),
      raw: {
        equipment: {
          equipped_items: [
            {
              item: { id: 2 },
              slot: { type: "RANGED", name: "Ranged" },
              quality: { type: "COMMON", name: "Common" },
              name: "Example Thrown",
              weapon: {
                damage: {
                  min_value: 1,
                  max_value: 2,
                  display_string: "1 - 2 Damage",
                },
                attack_speed: { value: 0, display_string: "" },
                dps: { value: 0, display_string: "" },
              },
            },
          ],
        },
      },
    });
    expect(profile.equipment[0]?.weapon).toEqual({
      damage: "1 - 2 Damage",
      minDamage: 1,
      maxDamage: 2,
      speedSeconds: 0,
      dpsValue: 0,
    });
  });

  it("maps professions, talents, reputations, boss statistics, and collections", () => {
    const profile = mapCharacterProfile({
      fallbackLevel: 7,
      iconUrl: String,
      itemIcons: new Map(),
      raw: {
        professions: {
          primaries: [
            {
              profession: { id: 186, name: "Mining" },
              tiers: [
                {
                  skill_points: 109,
                  max_skill_points: 150,
                  known_recipes: [{ name: "Smelt Tin", id: 2657 }],
                },
              ],
            },
          ],
          secondaries: [],
        },
        specializations: {
          specialization_groups: [
            {
              is_active: true,
              specializations: [
                {
                  specialization: { id: 26, name: "Arms" },
                  specialization_name: "Arms",
                  spent_points: 2,
                  talents: [
                    {
                      talent: { name: "Improved Rend" },
                      talent_rank: 1,
                      spell_tooltip: {
                        spell: { id: 12286 },
                        description: "Bleeds more.",
                        cast_time: "Passive",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        reputations: {
          reputations: [
            {
              faction: { id: 81, name: "Thunder Bluff" },
              standing: { value: 1086, max: 12000, tier: 5, name: "Honored" },
            },
          ],
        },
        achievementStatistics: {
          categories: [
            {
              id: 14807,
              name: "Dungeons & Raids",
              sub_categories: [
                {
                  id: 14821,
                  name: "Boss Kills",
                  statistics: [
                    { name: "Bazzalan kills (Ragefire Chasm)", quantity: 1 },
                  ],
                },
              ],
            },
          ],
        },
        mounts: { mounts: [{ mount: { name: "Example Mount" } }] },
        completedQuests: { quests: [{ name: "A" }, { name: "B" }] },
        pvp: { honorable_kills: 3, pvp_rank: 0 },
      },
    });
    expect(profile.summary?.level).toBe(7);
    expect(profile.professions).toEqual([
      {
        id: 186,
        name: "Mining",
        kind: "primary",
        skill: 109,
        maxSkill: 150,
        recipes: ["Smelt Tin"],
        recipeIds: [2657],
      },
    ]);
    expect(profile.specializations[0]?.talents[0]).toEqual({
      name: "Improved Rend",
      rank: 1,
      description: "Bleeds more.",
      castTime: "Passive",
      spellId: 12286,
    });
    expect(profile.reputations[0]).toMatchObject({
      faction: "Thunder Bluff",
      standing: "Honored",
      tier: 5,
    });
    expect(profile.statisticGroups).toEqual([
      {
        id: 14821,
        name: "Boss Kills",
        entries: [{ name: "Bazzalan kills (Ragefire Chasm)", quantity: 1 }],
      },
    ]);
    expect(profile.collections.mounts).toEqual(["Example Mount"]);
    expect(profile.quests.completedCount).toBe(2);
    expect(profile.pvp).toEqual({ honorableKills: 3, rank: 0 });
  });

  it("keeps quest ids and folds in the static quest text", () => {
    const profile = mapCharacterProfile({
      fallbackLevel: 1,
      iconUrl: () => "",
      itemIcons: new Map(),
      questInfo: new Map([
        [7, { description: "Speak with him.", area: "Orgrimmar" }],
      ]),
      raw: {
        quests: {
          in_progress: [
            { id: 7, name: "A Quiet Errand" },
            { name: "Nameless" },
          ],
        },
        completedQuests: {
          quests: [
            { id: 3, name: "First" },
            { id: 3, name: "First again" },
            { id: 4, name: "Second" },
          ],
        },
      },
    });
    expect(profile.quests).toEqual({
      inProgress: [
        {
          id: 7,
          name: "A Quiet Errand",
          description: "Speak with him.",
          area: "Orgrimmar",
        },
      ],
      completedCount: 3,
      recentCompleted: [
        { id: 3, name: "First" },
        { id: 4, name: "Second" },
      ],
    });
  });
});
