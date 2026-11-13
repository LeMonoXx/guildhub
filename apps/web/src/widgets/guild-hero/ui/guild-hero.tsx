import type { FeaturedMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useRef, type ReactNode } from "react";
import { ClassColoredName } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { arrangeTroop } from "../model/arrange-troop";
import { buildLineupScene } from "../model/build-lineup-scene";
import { useLiveStage } from "../model/use-live-stage";

interface GuildHeroProps {
  readonly members: readonly FeaturedMember[];
  readonly renderLiveStage: (
    scene: ReturnType<typeof buildLineupScene>,
  ) => ReactNode;
}

export function GuildHero({ members, renderLiveStage }: GuildHeroProps) {
  const { t } = useLocale();
  const stageRef = useRef<HTMLDivElement>(null);
  const live = useLiveStage(stageRef);
  const cast = members.slice(0, 6);
  const places = arrangeTroop(cast);
  const scene = buildLineupScene(cast);
  const named = [...places].sort(
    (left, right) => left.slot.x - right.slot.x || left.slot.z - right.slot.z,
  );

  return (
    <section className="guild-hero" aria-label={t("home.stageLabel")}>
      <div ref={stageRef} className="guild-hero-stage" data-live={live}>
        {live ? renderLiveStage(scene) : null}
      </div>
      <ol className="guild-hero-cast">
        {named.map((place, index) => (
          <li
            key={place.member.slug}
            className="guild-hero-member"
            style={{ animationDelay: `${String(index * 80)}ms` }}
          >
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
    </section>
  );
}
