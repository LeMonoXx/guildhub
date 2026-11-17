import type {
  GuildPartyResponse,
  WorldMapContinent,
  WorldMapZone,
} from "@guildhub/contracts";
import {
  dungeonPlace,
  placeArea,
  type MapPlace,
  type MapPoint,
  type MemberToken,
  type ZoneIndex,
} from "./map-layout";

/** What the map lights up: one quest's crew, one dungeon's group, or one member's partners. */
export type MapSpotlight =
  | { readonly kind: "quest"; readonly id: number }
  | { readonly kind: "dungeon"; readonly key: string }
  | { readonly kind: "member"; readonly slug: string };

export const sameSpotlight = (
  a: MapSpotlight | undefined,
  b: MapSpotlight | undefined,
): boolean => JSON.stringify(a) === JSON.stringify(b);

export interface MapLink {
  readonly id: string;
  readonly from: MapPoint;
  readonly to: MapPoint;
}

export interface MapScene {
  /** Members the spotlight is on; empty when nothing is. */
  readonly lit: ReadonlySet<string>;
  readonly links: readonly MapLink[];
  /** Where the camera flies when the spotlight is chosen. */
  readonly place?: MapPlace | undefined;
}

const tokenAt = (tokens: readonly MemberToken[], slug: string) =>
  tokens.find((token) => token.slug === slug);

/** Draws a line between each pair of neighbours so a crew reads as one chain. */
function chain(
  slugs: readonly string[],
  tokens: readonly MemberToken[],
  prefix: string,
): MapLink[] {
  const placed = slugs.flatMap((slug) => {
    const token = tokenAt(tokens, slug);
    return token === undefined ? [] : [token];
  });
  return placed.slice(1).map((token, index) => ({
    id: `${prefix}-${token.slug}`,
    from: (placed[index] as MemberToken).point,
    to: token.point,
  }));
}

function star(
  slugs: readonly string[],
  tokens: readonly MemberToken[],
  center: MapPoint,
  prefix: string,
): MapLink[] {
  return slugs.flatMap((slug) => {
    const token = tokenAt(tokens, slug);
    return token === undefined
      ? []
      : [{ id: `${prefix}-${slug}`, from: token.point, to: center }];
  });
}

const sceneBuilders: {
  readonly [K in MapSpotlight["kind"]]: (
    spotlight: Extract<MapSpotlight, { kind: K }>,
    party: GuildPartyResponse,
    index: ZoneIndex,
    tokens: readonly MemberToken[],
  ) => MapScene;
} = {
  quest: ({ id }, party, index, tokens) => {
    const quest = party.quests.find((q) => q.id === id);
    if (quest === undefined) return { lit: new Set(), links: [] };
    return {
      lit: new Set(quest.members),
      links: chain(quest.members, tokens, `quest-${String(id)}`),
      place:
        quest.area === undefined
          ? undefined
          : placeArea(index, party.dungeons, {
              area: quest.area,
              areaId: quest.areaId,
            }),
    };
  },
  dungeon: ({ key }, party, index, tokens) => {
    const dungeon = party.dungeons.find((d) => d.key === key);
    const place = dungeon && dungeonPlace(index, dungeon);
    if (dungeon === undefined || place === undefined)
      return { lit: new Set(), links: [] };
    const slugs = dungeon.group.map((seat) => seat.slug);
    return {
      lit: new Set(slugs),
      links: star(slugs, tokens, place.point, `dungeon-${key}`),
      place,
    };
  },
  member: ({ slug }, party, _index, tokens) => {
    const partners = [
      ...new Set(
        party.quests
          .filter((quest) => quest.members.includes(slug))
          .flatMap((quest) => quest.members)
          .filter((other) => other !== slug),
      ),
    ];
    const self = tokenAt(tokens, slug);
    return {
      lit: new Set([slug, ...partners]),
      links:
        self === undefined
          ? []
          : star(partners, tokens, self.point, `member-${slug}`),
      place: self?.place,
    };
  },
};

export function mapScene(
  spotlight: MapSpotlight | undefined,
  party: GuildPartyResponse,
  index: ZoneIndex,
  tokens: readonly MemberToken[],
): MapScene {
  if (spotlight === undefined) return { lit: new Set(), links: [] };
  const build = sceneBuilders[spotlight.kind] as (
    spotlight: MapSpotlight,
    party: GuildPartyResponse,
    index: ZoneIndex,
    tokens: readonly MemberToken[],
  ) => MapScene;
  return build(spotlight, party, index, tokens);
}

export interface ZoneHeat {
  readonly zone: WorldMapZone;
  readonly label: string;
  readonly quests: number;
  readonly members: number;
}

/** Zones on this continent where members have open quests, with the guild's name for each. */
export function zoneHeat(
  party: GuildPartyResponse,
  index: ZoneIndex,
  continent: WorldMapContinent,
): ZoneHeat[] {
  const heat = new Map<
    number,
    { zone: WorldMapZone; label: string; quests: number; members: Set<string> }
  >();
  for (const area of party.areas) {
    const place = placeArea(index, [], area);
    if (place === undefined || place.continent.uiMapId !== continent.uiMapId)
      continue;
    const entry = heat.get(place.zone.uiMapId) ?? {
      zone: place.zone,
      label: area.area,
      quests: 0,
      members: new Set<string>(),
    };
    for (const member of area.members) {
      entry.quests += member.quests;
      entry.members.add(member.slug);
    }
    heat.set(place.zone.uiMapId, entry);
  }
  return [...heat.values()].map((entry) => ({
    zone: entry.zone,
    label: entry.label,
    quests: entry.quests,
    members: entry.members.size,
  }));
}

/** A gentle arc from one point to another, bowing up and away from the straight line. */
export function arcPath(
  from: MapPoint,
  to: MapPoint,
  width: number,
  height: number,
): string {
  const a = { x: from.x * width, y: from.y * height };
  const b = { x: to.x * width, y: to.y * height };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bow = 0.22;
  const control = { x: mid.x + dy * bow, y: mid.y - Math.abs(dx) * bow };
  const round = (value: number) => value.toFixed(2);
  return `M${round(a.x)} ${round(a.y)} Q${round(control.x)} ${round(control.y)} ${round(b.x)} ${round(b.y)}`;
}
