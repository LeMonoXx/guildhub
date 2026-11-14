import type { FeaturedMember } from "@guildhub/contracts";
import { raceHeight } from "../../../entities/character";
import { standingFootprint } from "./gear-reach";
import type { Pose, Silhouette } from "./stage-view";

export interface TroopPlace {
  readonly member: FeaturedMember;
  readonly slot: Pose;
  readonly kneels: boolean;
}

/** A kneeling body is about this share of its standing height. */
const kneelHeight = 0.55;
/** The visible body is narrower than the footprint that keeps elbows apart. */
const silhouetteWidth = 0.85;

export const groundPose = (x: number, z: number): Pose => ({ x, y: 0, z });

export const withSlot = (
  place: TroopPlace,
  x: number,
  z: number,
): TroopPlace => ({
  ...place,
  slot: groundPose(x, z),
});

export const silhouetteAt = (place: TroopPlace, slot: Pose): Silhouette => ({
  slot,
  halfWidth: standingFootprint(place.member) * silhouetteWidth,
  height: raceHeight(place.member.raceId) * (place.kneels ? kneelHeight : 1),
});

export const silhouetteOf = (place: TroopPlace): Silhouette =>
  silhouetteAt(place, place.slot);
