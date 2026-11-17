import type { FeaturedMember } from "@guildhub/contracts";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import type { FrameDecorator } from "../../../shared/cinematic";
import { useLocale } from "../../../shared/i18n";
import { clearFogFigures } from "../../../shared/lib/fog-channel";
import { FogVeil } from "../../../shared/ui";
import type { buildLineupScene } from "../model/build-lineup-scene";
import { FogPresence } from "../model/fog-presence";
import { useElementSize } from "../model/use-element-size";
import { useFramedShare } from "../model/use-framed-share";
import { useLineupStage } from "../model/use-lineup-stage";
import { useLiveStage } from "../model/use-live-stage";
import { FogLine } from "./fog-line";
import { HeroStageOverlay } from "./hero-stage-overlay";
import { PosterCast } from "./poster-cast";

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
  const framedShare = useFramedShare(stageRef, size, live);
  const share = Math.min(1, Math.max(0.05, framedShare));
  // The renderer frames the area above the lower padding, then draws into it.
  const framedAspect = size.width / Math.max(size.height * share, 1);
  const camera = useMemo(
    () => lineup.framing.frameFor(framedAspect),
    [lineup.framing, framedAspect],
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
            framedShare={framedShare}
            onToggle={lineup.toggle}
          />
        ) : null}
      </div>
      {capable ? null : <PosterCast places={lineup.places} />}
    </section>
  );
}
