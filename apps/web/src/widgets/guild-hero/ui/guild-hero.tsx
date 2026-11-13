import type { FeaturedMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useRef, type ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
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
  const scene = buildLineupScene(members);

  return (
    <section className="guild-hero" aria-label={t("home.stageLabel")}>
      <div ref={stageRef} className="guild-hero-stage">
        {live ? renderLiveStage(scene) : null}
      </div>
      <ol className="guild-hero-cast">
        {members.map((member, index) => (
          <li
            key={member.slug}
            className="guild-hero-member"
            style={{
              animationDelay: `${String(index * 80)}ms`,
              ["--member-accent" as string]: `var(--${member.accent}, var(--color-gold))`,
            }}
          >
            <Link
              to="/characters/$characterSlug"
              params={{ characterSlug: member.slug }}
              className="reveal-name"
            >
              {member.name}
            </Link>
            <span>{member.surname}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
