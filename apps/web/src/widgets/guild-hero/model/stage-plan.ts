import { standingFootprint, walkingFootprint } from "./gear-reach";
import { groundDistance, lerpPose } from "./stage-motion";
import type { Pose } from "./stage-view";
import { groundPose, type TroopPlace } from "./troop-place";

/** Where everyone should stand, and when each one sets off. */
export interface StagePlan {
  readonly selected: string | undefined;
  targetOf(slug: string): Pose;
  startDelayOf(slug: string): number;
}

/** The chosen one stops this far in front of the front row. */
const spotlightDepth = 1.05;
/** How far off center the spotlight spot may be. */
const spotlightRange = 1.4;
/** Room between the walker's gear and those making way. */
const yieldMargin = 0.12;
/** Same-row neighbors that would be bumped move along. */
const sameRowDepth = 0.5;
const maxCascade = 6;
/** Those making way get this head start before the chosen one walks. */
const yieldLeadMs = 450;
/** On the way back, the chosen one gets this head start. */
const returnLeadMs = 520;

const homeOf = (places: readonly TroopPlace[], slug: string): Pose =>
  places.find((place) => place.member.slug === slug)?.slot ?? groundPose(0, 0);

/** Closest point to `point` on the walk from `from` to `to`. */
const closestOnWalk = (from: Pose, to: Pose, point: Pose): Pose => {
  const vx = to.x - from.x;
  const vz = to.z - from.z;
  const length = vx * vx + vz * vz;
  if (length === 0) return from;
  const t = ((point.x - from.x) * vx + (point.z - from.z) * vz) / length;
  return lerpPose(from, to, Math.min(Math.max(t, 0), 1));
};

/** Which way to step to get away from the walk at `walkX`; dead center steps outward. */
const sideAwayFrom = (x: number, walkX: number): number =>
  Math.sign(x - walkX) || Math.sign(x) || 1;

/** Everyone in their own slot; whoever was chosen walks back first. */
export class HomePlan implements StagePlan {
  readonly selected = undefined;

  constructor(
    private readonly places: readonly TroopPlace[],
    private readonly returning: string | undefined,
  ) {}

  targetOf(slug: string): Pose {
    return homeOf(this.places, slug);
  }

  startDelayOf(slug: string): number {
    return this.returning === undefined || slug === this.returning
      ? 0
      : returnLeadMs;
  }
}

/**
 * The chosen member walks to a spot in front of the troop. Anyone standing
 * on that walk steps sideways first, and same-row neighbors they would bump
 * move along with them, so nobody walks through anybody.
 */
export class StepForwardPlan implements StagePlan {
  private readonly targets = new Map<string, Pose>();

  constructor(
    private readonly places: readonly TroopPlace[],
    readonly selected: string,
    private readonly returning?: string,
  ) {
    const chosen = places.find((place) => place.member.slug === selected);
    if (!chosen) return;
    const frontZ = Math.max(...places.map((place) => place.slot.z));
    const spot = groundPose(
      Math.min(Math.max(chosen.slot.x, -spotlightRange), spotlightRange),
      frontZ + spotlightDepth,
    );
    this.targets.set(selected, spot);
    this.makeWay(chosen, spot);
  }

  get yielding(): readonly string[] {
    return [...this.targets.keys()].filter((slug) => slug !== this.selected);
  }

  targetOf(slug: string): Pose {
    return this.targets.get(slug) ?? homeOf(this.places, slug);
  }

  /** The previous pick walks back first, then the way clears, then the new pick walks. */
  startDelayOf(slug: string): number {
    const afterReturn =
      this.returning === undefined || slug === this.returning
        ? 0
        : returnLeadMs;
    const afterYield =
      slug === this.selected && this.yielding.length > 0 ? yieldLeadMs : 0;
    return afterReturn + afterYield;
  }

  private makeWay(chosen: TroopPlace, spot: Pose): void {
    const others = this.places.filter((place) => place !== chosen);
    for (const other of others) {
      const closest = closestOnWalk(chosen.slot, spot, other.slot);
      const needed =
        walkingFootprint(chosen.member) +
        standingFootprint(other.member) +
        yieldMargin;
      const gap = groundDistance(closest, other.slot);
      if (gap >= needed) continue;
      const away = sideAwayFrom(other.slot.x, closest.x);
      this.targets.set(
        other.member.slug,
        groundPose(other.slot.x + away * (needed - gap), other.slot.z),
      );
    }
    this.cascade(others);
  }

  /** Moved people push same-row neighbors along until nobody overlaps. */
  private cascade(others: readonly TroopPlace[]): void {
    for (let round = 0; round < maxCascade; round += 1) {
      let moved = false;
      for (const mover of others) {
        const moverAt = this.targetOf(mover.member.slug);
        if (moverAt === mover.slot) continue;
        for (const neighbor of others) {
          if (neighbor === mover) continue;
          const neighborAt = this.targetOf(neighbor.member.slug);
          if (Math.abs(neighborAt.z - moverAt.z) > sameRowDepth) continue;
          const needed =
            standingFootprint(mover.member) +
            standingFootprint(neighbor.member);
          const gap = groundDistance(moverAt, neighborAt);
          const pushing = Math.sign(moverAt.x - mover.slot.x);
          const ahead = Math.sign(neighborAt.x - moverAt.x) === pushing;
          if (gap >= needed || !ahead) continue;
          this.targets.set(
            neighbor.member.slug,
            groundPose(neighborAt.x + pushing * (needed - gap), neighborAt.z),
          );
          moved = true;
        }
      }
      if (!moved) return;
    }
  }
}

export const stagePlanFor = (
  places: readonly TroopPlace[],
  selected: string | undefined,
  previous?: string,
): StagePlan =>
  selected === undefined
    ? new HomePlan(places, previous)
    : new StepForwardPlan(places, selected, previous);
