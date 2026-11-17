import type {
  PartyDungeon,
  PartyMember,
  WorldMapContinent,
  WorldMapZone,
} from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import type { Camera, MapPoint, MemberToken } from "../model/map-layout";
import {
  arcPath,
  type MapScene,
  type MapSpotlight,
  type ZoneHeat,
} from "../model/map-scene";
import { MapPortal } from "./map-portal";
import { MapToken } from "./map-token";

export interface PortalPlace {
  readonly dungeon: PartyDungeon;
  readonly point: MapPoint;
}

interface MapStageProps {
  readonly continent: WorldMapContinent;
  readonly zone: WorldMapZone | undefined;
  readonly camera: Camera;
  readonly heat: readonly ZoneHeat[];
  readonly tokens: readonly MemberToken[];
  readonly members: ReadonlyMap<string, PartyMember>;
  readonly portals: readonly PortalPlace[];
  readonly scene: MapScene;
  readonly spotlight: MapSpotlight | undefined;
  readonly onZone: (zone: WorldMapZone) => void;
  readonly onHover: (spotlight: MapSpotlight | undefined) => void;
  readonly onSelect: (spotlight: MapSpotlight) => void;
}

const asset = (path: string) => `/assets/${path}`;

const rectStyle = (zone: WorldMapZone) => ({
  left: `${String(zone.rect.left * 100)}%`,
  top: `${String(zone.rect.top * 100)}%`,
  width: `${String((zone.rect.right - zone.rect.left) * 100)}%`,
  height: `${String((zone.rect.bottom - zone.rect.top) * 100)}%`,
});

const heatLevel = (quests: number) => Math.min(3, Math.ceil(quests / 6));

export function MapStage({
  continent,
  zone,
  camera,
  heat,
  tokens,
  members,
  portals,
  scene,
  spotlight,
  onZone,
  onHover,
  onSelect,
}: MapStageProps) {
  const { t } = useLocale();
  const { width, height } = continent.image;
  const anyLit = scene.lit.size > 0;
  const hover = (target: MapSpotlight) => (on: boolean) => {
    onHover(on ? target : undefined);
  };
  return (
    <div
      className="party-map-stage"
      style={{ aspectRatio: `${String(width)} / ${String(height)}` }}
      data-zoomed={zone !== undefined}
      data-lit={anyLit}
    >
      <div
        key={continent.uiMapId}
        className="party-map-world"
        style={{
          transform: `translate(${String(camera.x)}%, ${String(camera.y)}%) scale(${String(camera.scale)})`,
          ["--zoom" as string]: String(camera.scale),
        }}
      >
        <div className="party-map-art">
          <img
            src={asset(continent.image.path)}
            alt={t("party.mapAlt", { name: continent.name })}
            width={width}
            height={height}
            decoding="async"
          />
        </div>
        {continent.zones.map(
          (candidate) =>
            candidate.image !== null && (
              <img
                key={candidate.uiMapId}
                className="party-zone-art"
                data-visible={candidate.uiMapId === zone?.uiMapId}
                src={
                  candidate.uiMapId === zone?.uiMapId
                    ? asset(candidate.image.path)
                    : undefined
                }
                alt=""
                aria-hidden="true"
                style={rectStyle(candidate)}
              />
            ),
        )}
        {heat.map((entry, index) => (
          <button
            key={entry.zone.uiMapId}
            type="button"
            className="party-zone"
            data-heat={heatLevel(entry.quests)}
            data-focused={entry.zone.uiMapId === zone?.uiMapId}
            style={{
              ...rectStyle(entry.zone),
              ["--order" as string]: String(index),
            }}
            aria-label={t("party.zoneLabel", {
              name: entry.label,
              members: entry.members,
              quests: entry.quests,
            })}
            onClick={() => {
              onZone(entry.zone);
            }}
          >
            <span className="party-zone-label" aria-hidden="true">
              <strong>{entry.label}</strong>
              <span>
                {t("party.zoneStats", {
                  members: entry.members,
                  quests: entry.quests,
                })}
              </span>
            </span>
          </button>
        ))}
        <svg
          className="party-map-links"
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          aria-hidden="true"
        >
          {scene.links.map((link, index) => (
            <path
              key={link.id}
              d={arcPath(link.from, link.to, width, height)}
              className="party-link"
              style={{ ["--order" as string]: String(index) }}
            />
          ))}
        </svg>
        {portals.map(({ dungeon, point }, index) => (
          <MapPortal
            key={dungeon.key}
            dungeon={dungeon}
            point={point}
            order={index}
            lit={spotlight?.kind === "dungeon" && spotlight.key === dungeon.key}
            onHover={hover({ kind: "dungeon", key: dungeon.key })}
            onSelect={() => {
              onSelect({ kind: "dungeon", key: dungeon.key });
            }}
          />
        ))}
        {tokens.map((token, index) => {
          const member = members.get(token.slug);
          if (member === undefined) return null;
          const lit = scene.lit.has(token.slug);
          return (
            <MapToken
              key={token.slug}
              token={token}
              member={member}
              order={index}
              lit={lit}
              dimmed={anyLit && !lit}
              onHover={hover({ kind: "member", slug: token.slug })}
            />
          );
        })}
      </div>
      <div className="party-map-sweep" aria-hidden="true" />
      <div className="party-map-fog" aria-hidden="true" />
    </div>
  );
}
