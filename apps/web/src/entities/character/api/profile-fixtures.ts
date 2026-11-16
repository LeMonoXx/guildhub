import {
  characterProfileResponseSchema,
  type CharacterProfileResponse,
} from "@guildhub/contracts";
import { parseContract } from "../../../shared/api";
import { fixtureCharacterBySlug } from "./fixtures";

const fetchedAt = "2026-11-13T18:00:00.000Z";

export const fixtureCharacterProfile = (
  slug: string,
): CharacterProfileResponse | undefined => {
  const character = fixtureCharacterBySlug(slug);
  if (!character) return undefined;
  return parseContract(characterProfileResponseSchema, {
    characterId: character.characterId,
    slug: character.slug,
    status: "available",
    summary: {
      level: character.level,
      experience: 1200,
      gender: "Female",
      faction: "Horde",
      race: "Troll",
      className: "Rogue",
      guild: "Fixture Guild",
      lastLoginAt: fetchedAt,
      averageItemLevel: 21,
      equippedItemLevel: 20,
      achievementPoints: 10,
      activeTitle: "Private",
      ruleset: "Normal",
    },
    statistics: {
      health: 820,
      power: 100,
      powerType: "Energy",
      primary: [
        { type: "strength", base: 40, effective: 52 },
        { type: "agility", base: 60, effective: 88 },
        { type: "stamina", base: 44, effective: 61 },
        { type: "intellect", base: 20, effective: 20 },
        { type: "spirit", base: 25, effective: 27 },
      ],
      armor: { base: 0, effective: 640 },
      defense: { base: 140, effective: 140 },
      resistances: [
        { school: "fire", base: 0, effective: 5 },
        { school: "nature", base: 0, effective: 0 },
        { school: "frost", base: 0, effective: 0 },
        { school: "shadow", base: 0, effective: 10 },
        { school: "arcane", base: 0, effective: 0 },
      ],
      melee: {
        attackPower: 210,
        crit: 9.4,
        hit: 3,
        mainHand: { min: 30, max: 56, speed: 2.4, dps: 17.9 },
        offHand: { min: 14, max: 27, speed: 1.6, dps: 12.8 },
      },
      ranged: { attackPower: 60, crit: 6.1, hit: 0, min: 18, max: 33 },
      spell: {
        power: 0,
        healing: 0,
        crit: 1.2,
        hit: 0,
        penetration: 0,
        manaRegen: 0,
        manaRegenCombat: 0,
      },
      defenses: { dodge: 8.2, parry: 5, block: 0 },
      movementSpeed: 100,
    },
    equipment: [
      {
        slot: "HEAD",
        slotName: "Head",
        itemId: 1,
        name: "Fixture Hood",
        quality: "RARE",
        qualityName: "Rare",
        itemLevel: 24,
        requiredLevel: 19,
        binding: "Binds when equipped",
        itemClass: "Armor",
        itemSubclass: "Leather",
        inventoryType: "Head",
        armor: "62 Armor",
        stats: [
          {
            type: "AGILITY",
            label: "+6 Agility",
            value: 6,
            equipBonus: false,
            color: "#ffffff",
          },
          {
            type: "CRIT",
            label: "Improves your chance to get a critical strike by 1%.",
            value: 1,
            equipBonus: true,
            color: "#00ff00",
          },
        ],
        enchantments: ["+8 Agility"],
        durability: { current: 40, max: 50 },
        sellPriceCopper: 12_345,
        description: "Worn quietly.",
        quantity: 1,
      },
      {
        slot: "MAIN_HAND",
        slotName: "Main Hand",
        itemId: 2,
        name: "Fixture Blade",
        quality: "EPIC",
        qualityName: "Epic",
        itemLevel: 30,
        binding: "Binds when picked up",
        itemClass: "Weapon",
        itemSubclass: "Dagger",
        inventoryType: "One-Hand",
        weapon: {
          damage: "30 - 56 Damage",
          minDamage: 30,
          maxDamage: 56,
          speed: "Speed 2.40",
          speedSeconds: 2.4,
          dps: "(17.9 damage per second)",
          dpsValue: 17.9,
        },
        stats: [],
        enchantments: [],
        quantity: 1,
      },
    ],
    specializations: [
      {
        id: 1,
        name: "Assassination",
        spentPoints: 5,
        talents: [
          {
            name: "Malice",
            rank: 5,
            description: "Increases your critical strike chance by 5%.",
            castTime: "Passive",
            spellId: 14142,
          },
        ],
      },
    ],
    professions: [
      {
        id: 164,
        name: "Blacksmithing",
        kind: "primary",
        skill: 120,
        maxSkill: 150,
        recipes: ["Rough Sharpening Stone"],
      },
    ],
    reputations: [
      {
        factionId: 76,
        faction: "Orgrimmar",
        standing: "Honored",
        tier: 5,
        value: 4000,
        max: 12_000,
      },
    ],
    titles: ["Private"],
    pvp: { honorableKills: 12, rank: 1 },
    achievements: {
      total: 2,
      points: 10,
      recent: [{ id: 1, name: "Level 10", at: fetchedAt }],
      categories: [{ name: "General", quantity: 2, points: 10 }],
      inProgress: [{ id: 2, name: "Level 20" }],
    },
    statisticGroups: [
      {
        id: 14821,
        name: "Boss Kills",
        entries: [
          {
            name: "Bazzalan kills (Ragefire Chasm)",
            quantity: 1,
            at: fetchedAt,
          },
        ],
      },
    ],
    collections: {
      mounts: ["Swift Fixture"],
      pets: [{ name: "Tiny Fixture", level: 1, quality: "UNCOMMON" }],
      toys: [],
      heirlooms: [],
    },
    hunterPets: [],
    quests: {
      inProgress: [
        {
          id: 12,
          name: "A Quiet Errand",
          description: "Deliver the note and come back.",
          area: "Orgrimmar",
          minLevel: 1,
          experience: 250,
          moneyCopper: 50,
        },
      ],
      completedCount: 42,
      recentCompleted: [{ id: 3, name: "A Finished Errand" }],
    },
    avatarUrl: `/api/characters/${character.slug}/avatar`,
    fetchedAt,
    stale: false,
  });
};
