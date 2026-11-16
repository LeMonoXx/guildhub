import type { FeaturedMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import type { FrameDecorator } from "../../../cinematic";
import {
  ClassColoredName,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { clearFogFigures } from "../../../shared/lib/fog-channel";
import { FallbackImage, FogVeil } from "../../../shared/ui";
import type { buildLineupScene } from "../model/build-lineup-scene";
import { FogPresence } from "../model/fog-presence";
import type { TroopPlace } from "../model/troop-place";
import { useElementSize } from "../model/use-element-size";
import { useLineupStage } from "../model/use-lineup-stage";
import { useLiveStage } from "../model/use-live-stage";
import { HeroStageOverlay } from "./hero-stage-overlay";

interface GuildHeroProps {
  readonly members: readonly FeaturedMember[];
  readonly renderLiveStage: (
    scene: ReturnType<typeof buildLineupScene>,
    decorators: readonly FrameDecorator[],
  ) => ReactNode;
  /** A title card over the stage that clears away once the troop arrives. */
  readonly intro?: ReactNode;
}

export function GuildHero({ members, renderLiveStage, intro }: GuildHeroProps) {
  const { t } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const { capable, live } = useLiveStage(stageRef);
  const lineup = useLineupStage(members);
  const size = useElementSize(stageRef);
  const aspect = size.width / size.height;
  const camera = useMemo(
    () => lineup.framing.frameFor(aspect),
    [lineup.framing, aspect],
  );
  // The fog reads where everyone stands; it watches the frame, never changes it.
  const decorators = useMemo(
    () => [
      ...lineup.decorators,
      new FogPresence(lineup.places, () => stageRef.current),
    ],
    [lineup.decorators, lineup.places],
  );

  useEffect(
    () => () => {
      clearFogFigures();
    },
    [],
  );

  return (
    <section
      className="guild-hero"
      aria-label={t("home.stageLabel")}
      data-stage={capable ? "live" : "posters"}
    >
      <div ref={stageRef} className="guild-hero-stage">
        {live && intro ? (
          <div className="guild-hero-intro" aria-hidden="true">
            {intro}
          </div>
        ) : null}
        {live ? renderLiveStage(lineup.scene, decorators) : null}
        {live ? <FogVeil className="guild-hero-veil" /> : null}
        {live ? (
          <HeroStageOverlay
            places={lineup.places}
            bakes={lineup.bakes}
            plan={lineup.plan}
            selected={lineup.selected}
            assembled={lineup.assembled}
            size={size}
            camera={camera}
            onToggle={lineup.toggle}
          />
        ) : null}
      </div>
      {capable ? null : <PosterCast places={lineup.places} />}
    </section>
  );
}

/** Without the 3D stage, the members stand in a row of portraits. */
function PosterCast({ places }: { readonly places: readonly TroopPlace[] }) {
  const named = [...places].sort(
    (left, right) => left.slot.x - right.slot.x || left.slot.z - right.slot.z,
  );
  return (
    <ol className="guild-hero-cast">
      {named.map((place, index) => (
        <li
          key={place.member.slug}
          className="guild-hero-member"
          style={
            {
              animationDelay: `${String(index * 80)}ms`,
              "--member-class": wowClassColorVar(place.member.classId),
            } as CSSProperties
          }
        >
          <span className="guild-hero-portrait" aria-hidden="true">
            <FallbackImage
              src={place.member.renderUrl}
              fallback={null}
              loading="lazy"
            />
          </span>
          <ClassColoredName classId={place.member.classId}>
            <Link
              to="/characters/$characterSlug"
              params={{ characterSlug: place.member.slug }}
              className="reveal-name"
            >
              {place.member.name}
            </Link>
          </ClassColoredName>
          <span>{place.member.surname}</span>
        </li>
      ))}
    </ol>
  );
}
