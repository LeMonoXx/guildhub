import type { FeaturedMember } from "@guildhub/contracts";
import { raceRadius } from "../../../entities/character";

type CarriedGear = NonNullable<FeaturedMember["carries"]>[number];

/** How far carried gear sticks out past the body, in stage units. */
export interface GearReach {
  /** Past the shoulders, seen from the camera. */
  readonly side: number;
  /** Over whoever stands just in front, like a shield worn on the back. */
  readonly depth: number;
  /** Ahead of the body while walking: the walk cycle carries a shield forward. */
  readonly stride: number;
}

const noReach: GearReach = { side: 0, depth: 0, stride: 0 };

const reachByGear: Readonly<Record<CarriedGear, GearReach>> = {
  shield: { side: 0.24, depth: 0.4, stride: 0.5 },
  "two-hand": { side: 0.1, depth: 0.15, stride: 0.2 },
};

const widest = (left: GearReach, right: GearReach): GearReach => ({
  side: Math.max(left.side, right.side),
  depth: Math.max(left.depth, right.depth),
  stride: Math.max(left.stride, right.stride),
});

export const gearReachOf = (member: FeaturedMember): GearReach =>
  (member.carries ?? [])
    .map((gear) => reachByGear[gear])
    .reduce(widest, noReach);

/** Ground radius a member needs while standing, including gear. */
export const standingFootprint = (member: FeaturedMember): number =>
  raceRadius(member.raceId) + gearReachOf(member).side;

/** Ground radius a member needs while walking, including gear held forward. */
export const walkingFootprint = (member: FeaturedMember): number => {
  const reach = gearReachOf(member);
  return raceRadius(member.raceId) + Math.max(reach.side, reach.stride);
};
