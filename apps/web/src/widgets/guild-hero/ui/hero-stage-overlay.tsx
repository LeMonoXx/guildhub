import type { CharacterModelBake } from "@guildhub/contracts";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { bakeStatus, wowClassColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { FigureSilhouette } from "../../../shared/ui";
import type { StagePlan } from "../model/stage-plan";
import {
  aimBox,
  placeOnStage,
  StageProjection,
  type CameraPose,
  type StageBox,
} from "../model/stage-view";
import { silhouetteAt, type TroopPlace } from "../model/troop-place";
import type { Size } from "../model/use-element-size";
import { HeroMemberCard } from "./hero-member-card";

interface HeroStageOverlayProps {
  readonly places: readonly TroopPlace[];
  /** Members whose model is still being baked, and how far it is. */
  readonly bakes: ReadonlyMap<string, CharacterModelBake | undefined>;
  readonly plan: StagePlan;
  readonly selected: string | undefined;
  readonly assembled: boolean;
  /** The stage's size and the camera framed for it. */
  readonly size: Size;
  readonly camera: CameraPose;
  /**
   * Share of the stage the camera frames. The rest is padding the figures may
   * step into, and it is not part of the framed view.
   */
  readonly framedShare: number;
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
  bakes,
  plan,
  selected,
  assembled,
  size,
  camera,
  framedShare,
  onToggle,
}: HeroStageOverlayProps) {
  const { t } = useLocale();
  const [hovered, setHovered] = useState<string>();
  const aspect = size.width / size.height;
  const share = Math.min(1, Math.max(0.05, framedShare));
  const projection = useMemo(
    () => new StageProjection(aspect / share, camera),
    [aspect, camera, share],
  );
  const spots: readonly Spot[] = places.map((place) => ({
    place,
    box: aimBox(
      placeOnStage(
        projection.box(silhouetteAt(place, plan.targetOf(place.member.slug))),
        share,
      ),
    ),
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
      role="presentation"
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
        const waiting = bakes.has(slug);
        const status = waiting ? bakeStatus(bakes.get(slug), t) : undefined;
        return (
          <button
            key={slug}
            type="button"
            className="hero-hotspot"
            aria-pressed={selected === slug}
            aria-label={t("hero.select", { name: place.member.name })}
            data-focused={focused?.place === place}
            data-waiting={waiting}
            disabled={!assembled}
            style={
              {
                left: percent(box.left),
                top: percent(box.top),
                width: percent(box.width),
                height: percent(box.height),
                zIndex: depthLayer(place, plan),
                "--member-class": wowClassColorVar(place.member.classId),
              } as CSSProperties
            }
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
          >
            {status ? (
              <FigureSilhouette
                name={place.member.name}
                status={status.label}
                fraction={status.fraction}
              />
            ) : null}
          </button>
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
