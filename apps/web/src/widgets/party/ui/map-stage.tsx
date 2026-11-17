import type {
  PartyDungeon,
  PartyMember,
  WorldMapContinent,
  WorldMapZone,
} from "@guildhub/contracts";
import { useRef, type ReactNode } from "react";
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
import { useMapGestures, type MapGestureHandlers } from "./use-map-gestures";

/** How the camera got where it is; a flight eases, a drag follows the hand. */
export type CameraMotion = "fly" | "wheel" | "drag";

/** Stage height fraction a boss needs above its portal; nearer the top it stands below. */
const BOSS_ROOM_ABOVE = 0.42;

const CAMERA_MS: Record<CameraMotion, number> = {
  fly: 1100,
  wheel: 180,
  drag: 0,
};

export interface PortalPlace {
  readonly dungeon: PartyDungeon;
  readonly point: MapPoint;
}

interface MapStageProps {
  readonly continent: WorldMapContinent;
  /** The zone a click flew to; the rest of the continent dims around it. */
  readonly zone: WorldMapZone | undefined;
  /** The zone close enough to show its detailed map. */
  readonly detailed: WorldMapZone | undefined;
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
  readonly motion: CameraMotion;
  readonly gestures: MapGestureHandlers;
  /** Stands beside the lit dungeon's entrance. */
  readonly boss?:
    { readonly point: MapPoint; readonly node: ReactNode } | undefined;
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
  detailed,
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
  motion,
  gestures,
  boss,
}: MapStageProps) {
  const { t } = useLocale();
  const stage = useRef<HTMLDivElement>(null);
  const { dragging, handlers } = useMapGestures(stage, gestures);
  const { width, height } = continent.image;
  const anyLit = scene.lit.size > 0;
  const hover = (target: MapSpotlight) => (on: boolean) => {
    onHover(on ? target : undefined);
  };
  return (
    <div
      ref={stage}
      className="party-map-stage"
      style={{
        aspectRatio: `${String(width)} / ${String(height)}`,
        ["--camera-ms" as string]: `${String(dragging ? 0 : CAMERA_MS[motion])}ms`,
      }}
      data-zoomed={zone !== undefined}
      data-panned={camera.scale > 1}
      data-dragging={dragging}
      data-lit={anyLit}
      {...handlers}
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
        {continent.zones.map((candidate) => {
          if (candidate.image === null) return null;
          const shown = candidate.uiMapId === detailed?.uiMapId;
          return (
            <img
              key={candidate.uiMapId}
              className="party-zone-art"
              data-visible={shown}
              src={shown ? asset(candidate.image.path) : undefined}
              alt=""
              aria-hidden="true"
              style={rectStyle(candidate)}
            />
          );
        })}
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
              onSelect={() => {
                onSelect({ kind: "member", slug: token.slug });
              }}
            />
          );
        })}
        {boss !== undefined && (
          <div
            className="party-boss"
            data-below={
              boss.point.y * camera.scale + camera.y / 100 < BOSS_ROOM_ABOVE
            }
            style={{
              left: `${String(boss.point.x * 100)}%`,
              top: `${String(boss.point.y * 100)}%`,
            }}
            aria-hidden="true"
          >
            <div className="party-boss-body">{boss.node}</div>
          </div>
        )}
      </div>
      <div className="party-map-sweep" aria-hidden="true" />
      <div className="party-map-fog" aria-hidden="true" />
    </div>
  );
}
