import type {
  GuildPartyResponse,
  PartyDungeon,
  PartyMember,
  PartyQuest,
  PartyRole,
} from "@guildhub/contracts";

/** In-game icon file ids, served through the API's icon proxy. */
export const PARTY_ICONS = {
  tank: 132341,
  healer: 135907,
  damage: 132147,
  quest: 134939,
  portal: 136103,
} as const satisfies Record<PartyRole | "quest" | "portal", number>;

export type PartyIconName = keyof typeof PARTY_ICONS;

export const partyIconUrl = (icon: PartyIconName): string =>
  `/api/icons/${String(PARTY_ICONS[icon])}`;

export const membersBySlug = (
  party: GuildPartyResponse,
): ReadonlyMap<string, PartyMember> =>
  new Map(party.members.map((member) => [member.slug, member]));

export const questsWith = (
  party: GuildPartyResponse,
  slug: string,
): PartyQuest[] => party.quests.filter((quest) => quest.members.includes(slug));

/** Dungeons with someone to go, the most complete groups first. */
export const readyDungeons = (
  dungeons: readonly PartyDungeon[],
): PartyDungeon[] =>
  dungeons
    .filter((dungeon) => dungeon.group.length > 1)
    .sort(
      (a, b) => a.missing.length - b.missing.length || a.minLevel - b.minLevel,
    );

export const dungeonsFor = (
  party: GuildPartyResponse,
  slug: string,
): PartyDungeon[] =>
  readyDungeons(party.dungeons).filter((dungeon) =>
    dungeon.members.includes(slug),
  );
