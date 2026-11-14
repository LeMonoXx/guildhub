import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { useLocale } from "../../../shared/i18n";
import type { StagePlan } from "../model/stage-plan";
import {
  StageProjection,
  type CameraPose,
  type StageBox,
} from "../model/stage-view";
import { silhouetteAt, type TroopPlace } from "../model/troop-place";
import type { Size } from "../model/use-element-size";
import { HeroMemberCard } from "./hero-member-card";

interface HeroStageOverlayProps {
  readonly places: readonly TroopPlace[];
  readonly plan: StagePlan;
  readonly selected: string | undefined;
  readonly assembled: boolean;
  /** The stage's size and the camera framed for it. */
  readonly size: Size;
  readonly camera: CameraPose;
  readonly onToggle: (slug: string | undefined) => void;
}

interface Spot {
  readonly place: TroopPlace;
  readonly box: StageBox;
}

const percent = (fraction: number) => `${String(fraction * 100)}%`;
/** Closer rows sit on top so the one in front wins the hover. */
const depthLayer = (place: TroopPlace, plan: StagePlan) =>
  Math.round(plan.targetOf(place.member.slug).z * 100) + 1000;

const pixels = (value: number) => `${String(Math.round(value))}px`;

/** Where the light and the shade gather: the focused figure, measured from its feet. */
const focusStyle = (box: StageBox, size: Size) =>
  ({
    "--focus-x": pixels((box.left + box.width / 2) * size.width),
    "--focus-feet": pixels((box.top + box.height) * size.height),
    "--focus-centre": pixels((box.top + box.height / 2) * size.height),
    "--focus-height": pixels(box.height * size.height),
    "--focus-width": pixels(box.width * size.width),
  }) as CSSProperties;

/**
 * Plain DOM over the 3D lineup: a soft light on whoever is hovered or
 * selected, one target per member, and that member's card.
 */
export function HeroStageOverlay({
  places,
  plan,
  selected,
  assembled,
  size,
  camera,
  onToggle,
}: HeroStageOverlayProps) {
  const { t } = useLocale();
  const [hovered, setHovered] = useState<string>();
  const aspect = size.width / size.height;
  const projection = useMemo(
    () => new StageProjection(aspect, camera),
    [aspect, camera],
  );
  const spots: readonly Spot[] = places.map((place) => ({
    place,
    box: projection.box(silhouetteAt(place, plan.targetOf(place.member.slug))),
  }));
  const focused = spots.find(
    (spot) => spot.place.member.slug === (hovered ?? selected),
  );

  useEffect(() => {
    if (selected === undefined) return;
    const deselectOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggle(undefined);
    };
    document.addEventListener("keydown", deselectOnEscape);
    return () => {
      document.removeEventListener("keydown", deselectOnEscape);
    };
  }, [selected, onToggle]);

  return (
    <div
      className="hero-overlay"
      data-assembled={assembled}
      data-focus={focused !== undefined}
      data-selected={selected !== undefined}
      style={focused ? focusStyle(focused.box, size) : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onToggle(undefined);
      }}
    >
      <div className="hero-spotlight" aria-hidden="true" />
      {spots.map(({ place, box }) => {
        const slug = place.member.slug;
        return (
          <button
            key={slug}
            type="button"
            className="hero-hotspot"
            aria-pressed={selected === slug}
            aria-label={t("hero.select", { name: place.member.name })}
            data-focused={focused?.place === place}
            disabled={!assembled}
            style={{
              left: percent(box.left),
              top: percent(box.top),
              width: percent(box.width),
              height: percent(box.height),
              zIndex: depthLayer(place, plan),
            }}
            onPointerEnter={() => {
              setHovered(slug);
            }}
            onPointerLeave={() => {
              setHovered(undefined);
            }}
            onFocus={() => {
              setHovered(slug);
            }}
            onBlur={() => {
              setHovered(undefined);
            }}
            onClick={() => {
              onToggle(slug);
            }}
          />
        );
      })}
      {focused && assembled ? (
        <HeroMemberCard
          member={focused.place.member}
          box={focused.box}
          selected={focused.place.member.slug === selected}
        />
      ) : null}
    </div>
  );
}
