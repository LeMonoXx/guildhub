import type {
  GuildPartyResponse,
  PartyDungeon,
  WorldMapAtlas,
  WorldMapZone,
} from "@guildhub/contracts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import {
  clampCamera,
  zoneInView,
  panBy,
  sameCamera,
  ZONE_SCALE,
  zoomAt,
} from "../model/map-camera";
import {
  busiestContinent,
  cameraOn,
  dungeonPlace,
  memberTokens,
  WIDE_CAMERA,
  zoneIndex,
  type Camera,
} from "../model/map-layout";
import {
  mapScene,
  sameSpotlight,
  zoneHeat,
  type MapSpotlight,
} from "../model/map-scene";
import { membersBySlug } from "../model/party-lookup";
import { MapCaption } from "./map-caption";
import { MapLegend } from "./map-legend";
import { MapPanel } from "./map-panel";
import { MapStage, type CameraMotion, type PortalPlace } from "./map-stage";
import { MemberChip } from "./member-chip";

interface PartyMapProps {
  readonly party: GuildPartyResponse;
  readonly atlas: WorldMapAtlas;
  /** Draws a dungeon's last boss; the map stands it at the entrance while the dungeon is lit. */
  readonly renderBoss?: ((dungeon: PartyDungeon) => ReactNode) | undefined;
}

const BUTTON_ZOOM = 1.6;

/** The in-game world map with every member where they quest and every dungeon they could run. */
export function PartyMap({ party, atlas, renderBoss }: PartyMapProps) {
  const { t } = useLocale();
  const index = useMemo(() => zoneIndex(atlas), [atlas]);
  const tokens = useMemo(() => memberTokens(index, party), [index, party]);
  const members = useMemo(() => membersBySlug(party), [party]);
  const [continentId, setContinentId] = useState(
    () => busiestContinent(atlas, tokens)?.uiMapId,
  );
  /** The zone a click flew to; dragging or zooming by hand lets go of it. */
  const [focusedId, setFocusedId] = useState<number>();
  const [camera, setCamera] = useState<Camera>(WIDE_CAMERA);
  // Wheel and pointer events can arrive several times per frame, before React renders.
  const latestCamera = useRef<Camera>(WIDE_CAMERA);
  const [motion, setMotion] = useState<CameraMotion>("fly");
  const [hovered, setHovered] = useState<MapSpotlight>();
  const [pinned, setPinned] = useState<MapSpotlight>();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(undefined);
    };
    globalThis.addEventListener("keydown", onKey);
    return () => {
      globalThis.removeEventListener("keydown", onKey);
    };
  }, []);

  const continent =
    atlas.continents.find((c) => c.uiMapId === continentId) ??
    atlas.continents[0];
  if (continent === undefined) return null;
  const zone = continent.zones.find((z) => z.uiMapId === focusedId);
  const detailed = zone ?? zoneInView(continent.zones, camera);
  const spotlight = hovered ?? pinned;
  const scene = mapScene(spotlight, party, index, tokens);
  const portals = party.dungeons.flatMap((dungeon): PortalPlace[] => {
    const place = dungeonPlace(index, dungeon);
    return place === undefined || place.continent.uiMapId !== continent.uiMapId
      ? []
      : [{ dungeon, point: place.point }];
  });
  const onContinent = tokens.filter(
    (token) => token.place.continent.uiMapId === continent.uiMapId,
  );
  const placed = new Set(tokens.map((token) => token.slug));
  const wanderers = party.members.filter((member) => !placed.has(member.slug));
  const litPortal =
    spotlight?.kind === "dungeon"
      ? portals.find((portal) => portal.dungeon.key === spotlight.key)
      : undefined;

  const setView = (
    next: Camera,
    nextMotion: CameraMotion,
    focused?: WorldMapZone,
  ) => {
    latestCamera.current = next;
    setMotion(nextMotion);
    setCamera(next);
    setFocusedId(focused?.uiMapId);
  };
  const fly = (next: Camera, focused?: WorldMapZone) => {
    setView(next, "fly", focused);
  };
  const zoomCenter = (factor: number) => {
    setView(zoomAt(latestCamera.current, factor, 0.5, 0.5), "fly");
  };

  /** Picks from the list fly the map there; picks on the map leave the camera alone. */
  const select = (target: MapSpotlight, travel: boolean) => {
    if (sameSpotlight(pinned, target)) {
      setPinned(undefined);
      return;
    }
    setPinned(target);
    if (!travel) return;
    const place = mapScene(target, party, index, tokens).place;
    if (place === undefined) return;
    setContinentId(place.continent.uiMapId);
    if (place.zone.uiMapId !== zone?.uiMapId)
      fly(cameraOn(place.zone), place.zone);
  };

  return (
    <div className="party-map">
      <div className="party-map-toolbar">
        <div
          className="party-map-continents"
          role="group"
          aria-label={t("party.continents")}
        >
          {atlas.continents.map((candidate) => {
            const count = tokens.filter(
              (token) => token.place.continent.uiMapId === candidate.uiMapId,
            ).length;
            return (
              <button
                key={candidate.uiMapId}
                type="button"
                aria-pressed={candidate.uiMapId === continent.uiMapId}
                onClick={() => {
                  setContinentId(candidate.uiMapId);
                  fly(WIDE_CAMERA);
                }}
              >
                {t(`party.continent.${String(candidate.uiMapId)}`)}
                <span className="party-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="party-map-layout">
        <div className="party-map-main">
          <div
            className="party-map-viewport"
            style={{
              ["--map-ratio" as string]: String(
                continent.image.width / continent.image.height,
              ),
            }}
          >
            <MapStage
              continent={continent}
              zone={zone}
              detailed={detailed}
              camera={camera}
              heat={zoneHeat(party, index, continent)}
              tokens={onContinent}
              members={members}
              portals={portals}
              scene={scene}
              spotlight={spotlight}
              onZone={(next) => {
                if (camera.scale < ZONE_SCALE) fly(cameraOn(next), next);
              }}
              onHover={setHovered}
              onSelect={(target) => {
                select(target, false);
              }}
              motion={motion}
              gestures={{
                onPan: (dx, dy) => {
                  setView(panBy(latestCamera.current, dx, dy), "drag");
                },
                onZoom: (factor, fx, fy) => {
                  const current = latestCamera.current;
                  const next = zoomAt(current, factor, fx, fy);
                  if (sameCamera(next, current)) return false;
                  setView(next, "wheel");
                  return true;
                },
              }}
              boss={
                litPortal === undefined || renderBoss === undefined
                  ? undefined
                  : {
                      point: litPortal.point,
                      node: renderBoss(litPortal.dungeon),
                    }
              }
            />
            <div className="party-map-zoom">
              <button
                type="button"
                aria-label={t("party.zoomIn")}
                title={t("party.zoomIn")}
                onClick={() => {
                  zoomCenter(BUTTON_ZOOM);
                }}
              >
                +
              </button>
              <button
                type="button"
                aria-label={t("party.zoomStep")}
                title={t("party.zoomStep")}
                disabled={camera.scale <= 1}
                onClick={() => {
                  zoomCenter(1 / BUTTON_ZOOM);
                }}
              >
                −
              </button>
              <button
                type="button"
                className="party-map-zoom-reset"
                disabled={sameCamera(clampCamera(camera), WIDE_CAMERA)}
                onClick={() => {
                  fly(WIDE_CAMERA);
                }}
              >
                {t("party.zoomOut")}
              </button>
            </div>
            <MapCaption
              spotlight={spotlight}
              pinned={
                spotlight !== undefined && sameSpotlight(spotlight, pinned)
              }
              party={party}
              members={members}
              index={index}
            />
          </div>
          <MapLegend />
        </div>
        <MapPanel
          party={party}
          members={members}
          spotlight={spotlight}
          onHover={setHovered}
          onSelect={(target) => {
            select(target, true);
          }}
        />
      </div>
      {wanderers.length > 0 && (
        <section className="party-wanderers" aria-labelledby="party-wanderers">
          <h2 id="party-wanderers" className="party-column-title">
            {t("party.wanderers")}
          </h2>
          <p className="muted">{t("party.wanderersLead")}</p>
          <ul className="party-crew">
            {wanderers.map((member) => (
              <li key={member.slug}>
                <MemberChip member={member} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
