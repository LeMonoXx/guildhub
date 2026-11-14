export const characterAppearance = {
  character: {
    name: "Guildmaster",
    surname: "Example",
    id: 101,
    slug: "guildmaster-example",
  },
  playable_race: { id: 1, name: "Human" },
  playable_class: { id: 1, name: "Warrior" },
  gender: { type: "MALE", name: "Male" },
  faction: { type: "ALLIANCE", name: "Alliance" },
  customizations: [
    {
      option: { name: "Skin Color", id: 58 },
      choice: { id: 915, display_order: 0 },
    },
    { option: { name: "Face", id: 59 }, choice: { id: 940, display_order: 0 } },
  ],
  items: [
    {
      id: 16820,
      slot: { type: "CHEST", name: "Chest" },
      enchant: 0,
      internal_slot_id: 4,
    },
  ],
};

export const characterEquipment = {
  character: characterAppearance.character,
  equipped_items: [
    {
      item: { id: 16820 },
      slot: { type: "CHEST", name: "Chest" },
      inventory_type: { type: "CHEST", name: "Chest" },
      name: "Nightslayer Chestpiece",
      quantity: 1,
      quality: { type: "EPIC", name: "Epic" },
      media: { id: 16820 },
      item_class: { id: 4, name: "Armor" },
      item_subclass: { id: 2, name: "Leather" },
      level: { value: 66, display_string: "Item Level 66" },
    },
    {
      item: { id: 19019 },
      slot: { type: "MAIN_HAND", name: "Main Hand" },
      inventory_type: { type: "WEAPON", name: "Weapon" },
      name: "Thunderfury",
      quantity: 1,
      quality: { type: "LEGENDARY", name: "Legendary" },
      media: { id: 19019 },
      item_class: { id: 2, name: "Weapon" },
      item_subclass: { id: 7, name: "Sword" },
      level: { value: 80, display_string: "Item Level 80" },
    },
  ],
};

export const characterMedia = {
  character: characterAppearance.character,
  assets: [
    {
      key: "main-raw",
      value: "https://render.worldofwarcraft.com/character/guildmaster.png",
    },
    {
      key: "avatar",
      value: "https://render.worldofwarcraft.com/avatar/guildmaster.png",
    },
  ],
};

const memberCharacter = {
  name: "Member",
  surname: "Example",
  id: 102,
  slug: "member-example",
};

export const memberAppearance = {
  character: memberCharacter,
  playable_race: { id: 4, name: "Night Elf" },
  playable_class: { id: 8, name: "Mage" },
  gender: { type: "FEMALE", name: "Female" },
  faction: { type: "ALLIANCE", name: "Alliance" },
  customizations: [
    {
      option: { name: "Skin Color", id: 80 },
      choice: { id: 801, display_order: 0 },
    },
  ],
  items: [
    {
      id: 16688,
      slot: { type: "CHEST", name: "Chest" },
      enchant: 0,
      internal_slot_id: 4,
    },
  ],
};

export const memberEquipment = {
  character: memberCharacter,
  equipped_items: [
    {
      item: { id: 16688 },
      slot: { type: "CHEST", name: "Chest" },
      inventory_type: { type: "ROBE", name: "Robe" },
      name: "Magister's Robes",
      quantity: 1,
      quality: { type: "EPIC", name: "Epic" },
      media: { id: 16688 },
      item_class: { id: 4, name: "Armor" },
      item_subclass: { id: 1, name: "Cloth" },
      level: { value: 63, display_string: "Item Level 63" },
    },
  ],
};

export const memberMedia = {
  character: memberCharacter,
  assets: [
    {
      key: "main-raw",
      value: "https://render.worldofwarcraft.com/character/member.png",
    },
  ],
};

export function appearanceFor(slug: string) {
  return slug === memberCharacter.slug ? memberAppearance : characterAppearance;
}

export function equipmentFor(slug: string) {
  return slug === memberCharacter.slug ? memberEquipment : characterEquipment;
}

export function mediaFor(slug: string) {
  return slug === memberCharacter.slug ? memberMedia : characterMedia;
}

export const guildProfile = {
  _links: { self: { href: "/data/wow/guild/example-guild" } },
  id: 1,
  name: "Example Guild",
  slug: "example-guild",
  name_search: "Example Guild",
  faction: { type: "ALLIANCE", name: "Alliance" },
  achievement_points: 0,
  member_count: 2,
  created_timestamp: 0,
  roster: { href: "/data/wow/guild/example-guild/roster" },
  achievements: { href: "/data/wow/guild/example-guild/achievements" },
  activity: { href: "/data/wow/guild/example-guild/activity" },
};

export const guildRoster = {
  _links: { self: { href: "/data/wow/guild/example-guild/roster" } },
  guild: {
    name: "Example Guild",
    id: 1,
    slug: "example-guild",
    faction: { type: "ALLIANCE", name: "Alliance" },
    key: { href: "/data/wow/guild/example-guild" },
  },
  members: [
    {
      character: {
        name: "Guildmaster",
        surname: "Example",
        id: 101,
        level: 80,
        slug: "guildmaster-example",
        faction: { type: "ALLIANCE" },
        playable_class: { id: 1, name: "Warrior" },
        playable_race: { id: 1, name: "Human" },
        key: { href: "/profile/wow/character/guildmaster-example" },
      },
      rank: 0,
    },
    {
      character: {
        name: "Member",
        surname: "Example",
        id: 102,
        level: 80,
        slug: "member-example",
        faction: { type: "ALLIANCE" },
        playable_class: { id: 8, name: "Mage" },
        playable_race: { id: 4, name: "Night Elf" },
        key: { href: "/profile/wow/character/member-example" },
      },
      rank: 4,
    },
  ],
};
