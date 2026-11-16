import type { FeaturedMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import type { FrameDecorator } from "../../../shared/cinematic";
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
  /** Spoken once the title has left: it rises out of the fog and melts away. */
  readonly line?: string;
}

export function GuildHero({
  members,
  renderLiveStage,
  intro,
  line,
}: GuildHeroProps) {
  const { t } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
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
          <div
            className="guild-hero-intro"
            aria-hidden="true"
            onAnimationEnd={(event) => {
              if (
                event.animationName !== "intro-rise" ||
                event.target !== event.currentTarget
              )
                return;
              lineRef.current?.classList.add("is-playing");
            }}
          >
            {intro}
          </div>
        ) : null}
        {live && line ? <FogLine text={line} lineRef={lineRef} /> : null}
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

/** A stable melt: each letter drips a different way, the same way every visit. */
function drift(index: number): { x: string; y: string; rot: string } {
  const angle = (index * 137.5 * Math.PI) / 180;
  const side = index % 2 === 0 ? 1 : -1;
  return {
    x: `${String(Math.round(side * (16 + (index % 5) * 12 + Math.cos(angle) * 8)))}px`,
    y: `${String(Math.round(18 + (index % 4) * 14 + Math.sin(angle) * 8))}px`,
    rot: `${String(((index % 7) - 3) * 7)}deg`,
  };
}

function FogLine({
  text,
  lineRef,
}: {
  readonly text: string;
  readonly lineRef: RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <p ref={lineRef} className="fog-line" aria-hidden="true">
      {Array.from(text).map((char, index) => {
        const shift = drift(index);
        return (
          <span
            key={`${char}-${String(index)}`}
            style={
              {
                ["--i"]: String(index),
                ["--dx"]: shift.x,
                ["--dy"]: shift.y,
                ["--rot"]: shift.rot,
              } as CSSProperties
            }
          >
            {char === " " ? "\u00a0" : char}
          </span>
        );
      })}
    </p>
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
