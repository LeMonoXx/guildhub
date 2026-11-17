import type { GuildPartyResponse, WorldMapAtlas } from "@guildhub/contracts";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "../../../shared/i18n";
import {
  busiestContinent,
  cameraOn,
  dungeonPlace,
  memberTokens,
  WIDE_CAMERA,
  zoneIndex,
} from "../model/map-layout";
import {
  mapScene,
  sameSpotlight,
  zoneHeat,
  type MapSpotlight,
} from "../model/map-scene";
import { membersBySlug } from "../model/party-lookup";
import { MapPanel } from "./map-panel";
import { MapStage, type PortalPlace } from "./map-stage";
import { MemberChip } from "./member-chip";

interface PartyMapProps {
  readonly party: GuildPartyResponse;
  readonly atlas: WorldMapAtlas;
}

/** The in-game world map with every member where they quest and every dungeon they could run. */
export function PartyMap({ party, atlas }: PartyMapProps) {
  const { t } = useLocale();
  const index = useMemo(() => zoneIndex(atlas), [atlas]);
  const tokens = useMemo(() => memberTokens(index, party), [index, party]);
  const members = useMemo(() => membersBySlug(party), [party]);
  const [continentId, setContinentId] = useState(
    () => busiestContinent(atlas, tokens)?.uiMapId,
  );
  const [zoneId, setZoneId] = useState<number>();
  const [hovered, setHovered] = useState<MapSpotlight>();
  const [pinned, setPinned] = useState<MapSpotlight>();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setZoneId(undefined);
      setPinned(undefined);
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
  const zone = continent.zones.find((z) => z.uiMapId === zoneId);
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

  const select = (target: MapSpotlight) => {
    if (sameSpotlight(pinned, target)) {
      setPinned(undefined);
      return;
    }
    setPinned(target);
    const place = mapScene(target, party, index, tokens).place;
    if (place === undefined) return;
    setContinentId(place.continent.uiMapId);
    setZoneId(place.zone.uiMapId);
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
                  setZoneId(undefined);
                }}
              >
                {t(`party.continent.${String(candidate.uiMapId)}`)}
                <span className="party-count">{count}</span>
              </button>
            );
          })}
        </div>
        {zone !== undefined && (
          <button
            type="button"
            className="party-map-back"
            onClick={() => {
              setZoneId(undefined);
            }}
          >
            {t("party.zoomOut")}
          </button>
        )}
      </div>
      <div className="party-map-layout">
        <MapStage
          continent={continent}
          zone={zone}
          camera={zone === undefined ? WIDE_CAMERA : cameraOn(zone)}
          heat={zoneHeat(party, index, continent)}
          tokens={onContinent}
          members={members}
          portals={portals}
          scene={scene}
          spotlight={spotlight}
          onZone={(next) => {
            setZoneId(next.uiMapId === zoneId ? undefined : next.uiMapId);
          }}
          onHover={setHovered}
          onSelect={select}
        />
        <MapPanel
          party={party}
          members={members}
          spotlight={spotlight}
          onHover={setHovered}
          onSelect={select}
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
