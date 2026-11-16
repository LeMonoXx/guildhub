import type { FeaturedMember } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";

import {
  ClassColoredName,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import type { StageBox } from "../model/stage-view";

interface HeroMemberCardProps {
  readonly member: FeaturedMember;
  readonly box: StageBox;
  /** A selected member's card stays and links to the profile. */
  readonly selected: boolean;
}

const percent = (fraction: number) => `${String(fraction * 100)}%`;
/** Hair, horns and helmets rise above the race's nominal height. */
const HEADROOM = 0.2;
/** Below this, a card above the head would leave the stage under the header. */
const PIN_BELOW = 0.16;

/** Name, level, race and class, floating above the member on stage. */
export function HeroMemberCard({ member, box, selected }: HeroMemberCardProps) {
  const { t } = useLocale();
  const aboveHead = box.top - box.height * HEADROOM;
  const pinned = aboveHead < PIN_BELOW;
  return (
    <div
      className="hero-member-card"
      data-selected={selected}
      data-pinned={pinned}
      role="status"
      style={
        {
          left: percent(box.left + box.width / 2),
          top: pinned ? "4.6rem" : percent(aboveHead),
          "--member-class": wowClassColorVar(member.classId),
        } as CSSProperties
      }
    >
      <ClassColoredName classId={member.classId}>
        <strong className="hero-member-card-name">{member.name}</strong>
      </ClassColoredName>
      <span className="hero-member-card-surname">{member.surname}</span>
      <span className="hero-member-card-facts">
        {t("hero.level", { level: member.level })} ·{" "}
        {t(`race.${member.raceId}`)} · {t(`class.${member.classId}`)}
      </span>
      {selected ? (
        <Link
          to="/characters/$characterSlug"
          params={{ characterSlug: member.slug }}
          className="hero-member-card-link"
        >
          {t("hero.openProfile")}
        </Link>
      ) : null}
    </div>
  );
}
