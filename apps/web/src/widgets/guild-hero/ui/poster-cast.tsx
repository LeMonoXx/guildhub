import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import {
  ClassColoredName,
  wowClassColorVar,
} from "../../../entities/character";
import { FallbackImage } from "../../../shared/ui";
import type { TroopPlace } from "../model/troop-place";

/** Without the 3D stage, the members stand in a row of portraits. */
export function PosterCast({
  places,
}: {
  readonly places: readonly TroopPlace[];
}) {
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
