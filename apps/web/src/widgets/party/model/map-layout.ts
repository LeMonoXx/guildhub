import type {
  GuildPartyResponse,
  PartyDungeon,
  WorldMapAtlas,
  WorldMapContinent,
  WorldMapZone,
} from "@guildhub/contracts";

/** A spot on a continent map, both axes 0..1 from its top left. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface MapPlace {
  readonly continent: WorldMapContinent;
  readonly zone: WorldMapZone;
  readonly point: MapPoint;
  /** Set when the place is a dungeon's entrance. */
  readonly dungeon?: PartyDungeon;
}

export interface ZoneIndex {
  byArea: ReadonlyMap<
    number,
    { continent: WorldMapContinent; zone: WorldMapZone }
  >;
  byName: ReadonlyMap<
    string,
    { continent: WorldMapContinent; zone: WorldMapZone }
  >;
}

export function zoneIndex(atlas: WorldMapAtlas): ZoneIndex {
  const byArea = new Map<
    number,
    { continent: WorldMapContinent; zone: WorldMapZone }
  >();
  const byName = new Map<
    string,
    { continent: WorldMapContinent; zone: WorldMapZone }
  >();
  for (const continent of atlas.continents)
    for (const zone of continent.zones) {
      byName.set(zone.name.toLowerCase(), { continent, zone });
      for (const areaId of zone.areaIds)
        if (!byArea.has(areaId)) byArea.set(areaId, { continent, zone });
    }
  return { byArea, byName };
}

export const zoneCenter = (zone: WorldMapZone): MapPoint => ({
  x: (zone.rect.left + zone.rect.right) / 2,
  y: (zone.rect.top + zone.rect.bottom) / 2,
});

export const zonePoint = (
  zone: WorldMapZone,
  x: number,
  y: number,
): MapPoint => ({
  x: zone.rect.left + x * (zone.rect.right - zone.rect.left),
  y: zone.rect.top + y * (zone.rect.bottom - zone.rect.top),
});

export function dungeonPlace(
  index: ZoneIndex,
  dungeon: PartyDungeon,
): MapPlace | undefined {
  const found = index.byArea.get(dungeon.entrance.areaId);
  if (found === undefined) return undefined;
  return {
    ...found,
    point: zonePoint(found.zone, dungeon.entrance.x, dungeon.entrance.y),
    dungeon,
  };
}

/**
 * Where an area lies on the map: its zone's middle, or the entrance of the
 * dungeon it belongs to. Names only help while profiles still lack area ids.
 */
export function placeArea(
  index: ZoneIndex,
  dungeons: readonly PartyDungeon[],
  area: { readonly areaId?: number | undefined; readonly area: string },
): MapPlace | undefined {
  const { areaId } = area;
  const dungeon =
    areaId === undefined
      ? undefined
      : dungeons.find((d) => d.areaIds.includes(areaId));
  if (dungeon !== undefined) return dungeonPlace(index, dungeon);
  const found =
    (areaId === undefined ? undefined : index.byArea.get(areaId)) ??
    index.byName.get(area.area.toLowerCase());
  return found === undefined
    ? undefined
    : { ...found, point: zoneCenter(found.zone) };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Spreads `count` tokens around one spot in a sunflower, the first at the middle. */
export function spread(index: number, count: number, radius: number): MapPoint {
  if (count <= 1) return { x: 0, y: 0 };
  const distance = radius * Math.sqrt(index / (count - 1));
  const angle = index * GOLDEN_ANGLE;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 1.5 };
}

export interface Camera {
  readonly scale: number;
  /** Translation in percent of the stage. */
  readonly x: number;
  readonly y: number;
}

export const WIDE_CAMERA: Camera = { scale: 1, x: 0, y: 0 };

/** The camera that fills the stage with a zone and keeps a margin around it. */
export function cameraOn(zone: WorldMapZone, margin = 0.92): Camera {
  const width = zone.rect.right - zone.rect.left;
  const height = zone.rect.bottom - zone.rect.top;
  const scale = Math.min(margin / width, margin / height);
  const center = zoneCenter(zone);
  return {
    scale,
    x: (0.5 - center.x * scale) * 100,
    y: (0.5 - center.y * scale) * 100,
  };
}

export interface MemberToken {
  readonly slug: string;
  readonly place: MapPlace;
  readonly point: MapPoint;
}

const TOKEN_SPREAD = 0.026;

/** One token per member with a known focus, fanned out where several meet. */
export function memberTokens(
  index: ZoneIndex,
  party: GuildPartyResponse,
): MemberToken[] {
  const placed = party.members.flatMap((member) => {
    if (member.focus === undefined) return [];
    const place = placeArea(index, party.dungeons, member.focus);
    return place === undefined ? [] : [{ slug: member.slug, place }];
  });
  const groups = new Map<string, typeof placed>();
  for (const token of placed) {
    const key = `${String(token.place.point.x)}:${String(token.place.point.y)}`;
    groups.set(key, [...(groups.get(key) ?? []), token]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((token, i) => {
      const offset = spread(i, group.length, TOKEN_SPREAD);
      return {
        ...token,
        point: {
          x: token.place.point.x + offset.x,
          y: token.place.point.y + offset.y,
        },
      };
    }),
  );
}

/** The continent with the most of the guild on it, the first one otherwise. */
export function busiestContinent(
  atlas: WorldMapAtlas,
  tokens: readonly MemberToken[],
): WorldMapContinent | undefined {
  const count = (continent: WorldMapContinent) =>
    tokens.filter(
      (token) => token.place.continent.uiMapId === continent.uiMapId,
    ).length;
  return [...atlas.continents].sort((a, b) => count(b) - count(a))[0];
}
