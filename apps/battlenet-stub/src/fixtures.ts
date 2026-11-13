export const guildProfile = {
  _links: { self: { href: "/data/wow/guild/example-guild" } },
  id: 1,
  name: "Example Guild",
  name_slug: "example-guild",
  faction: { type: "ALLIANCE", name: "Alliance" },
  achievement_points: 0,
  member_count: 2,
};

export const guildRoster = {
  _links: { self: { href: "/data/wow/guild/example-guild/roster" } },
  guild: {
    name: "Example Guild",
    id: 1,
    name_slug: "example-guild",
  },
  members: [
    {
      character: {
        name: "Guildmaster",
        surname: "Example",
        id: 101,
        level: 80,
        playable_class: { id: 1, name: "Warrior" },
        playable_race: { id: 1, name: "Human" },
      },
      rank: 0,
    },
    {
      character: {
        name: "Member",
        surname: "Example",
        id: 102,
        level: 80,
        playable_class: { id: 8, name: "Mage" },
        playable_race: { id: 4, name: "Night Elf" },
      },
      rank: 4,
    },
  ],
};
