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
