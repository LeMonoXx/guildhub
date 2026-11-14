import type { FeaturedMember } from "@guildhub/contracts";
import { keepsGearDown } from "./gear-stances";

export interface WalkFlavor {
  readonly clip: "Walk" | "StealthWalk";
  /** The stance a hero arrives in before walking, matching the walk's posture. */
  readonly arrival: "Stand" | "StealthStand";
  readonly rate: number;
  readonly travelMs: number;
}

const walkFlavors: readonly [WalkFlavor, ...WalkFlavor[]] = [
  { clip: "Walk", arrival: "Stand", rate: 0.78, travelMs: 5200 },
  { clip: "StealthWalk", arrival: "StealthStand", rate: 0.74, travelMs: 5600 },
  { clip: "Walk", arrival: "Stand", rate: 0.8, travelMs: 5000 },
  { clip: "Walk", arrival: "Stand", rate: 0.76, travelMs: 5400 },
  { clip: "StealthWalk", arrival: "StealthStand", rate: 0.72, travelMs: 5800 },
  { clip: "Walk", arrival: "Stand", rate: 0.79, travelMs: 5100 },
];

/**
 * Each lineup position walks a little differently, so the troop never marches
 * in step. Whoever would sneak with a raised shield walks upright instead.
 */
export const walkFlavorFor = (
  index: number,
  member: FeaturedMember,
): WalkFlavor => {
  const flavor = walkFlavors[index % walkFlavors.length] ?? walkFlavors[0];
  const keepsDown = keepsGearDown(member);
  return keepsDown(flavor.clip) && keepsDown(flavor.arrival)
    ? flavor
    : { ...flavor, clip: "Walk", arrival: "Stand" };
};
