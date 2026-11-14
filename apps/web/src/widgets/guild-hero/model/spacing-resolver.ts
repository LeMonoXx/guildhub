import { standingFootprint } from "./gear-reach";
import { coverage, lateralClearance } from "./stage-view";
import { silhouetteOf, withSlot, type TroopPlace } from "./troop-place";

/** Nobody may hide more than this share of anyone standing behind them. */
export const maxCoverage = 0.25;
/** A kneeler only hides legs, so it may cover a little more. */
const kneelerCoverage = 0.3;
/** Kneelers tuck in closer to whoever they kneel in front of. */
const kneelerFootprintShare = 0.62;
const footprintGap = 0.16;
const minRowDepth = 0.2;
const maxPasses = 200;

type Side = 1 | -1;

/**
 * Pushes people apart until no two footprints touch and nobody hides more
 * than the allowed share of someone behind them, as seen from the lineup
 * camera. Centering shifts rows against each other on screen, so it runs
 * every pass and the final check sees the centered troop.
 */
export class SpacingResolver {
  private places: TroopPlace[];

  constructor(places: readonly TroopPlace[]) {
    this.places = [...places];
  }

  resolve(): TroopPlace[] {
    for (let pass = 0; pass < maxPasses; pass += 1) {
      this.center();
      if (!this.relaxPairs()) break;
    }
    return this.places;
  }

  private relaxPairs(): boolean {
    let moved = false;
    for (let a = 0; a < this.places.length; a += 1) {
      for (let b = a + 1; b < this.places.length; b += 1) {
        moved =
          this.separateFootprints(a, b) || this.clearSightline(a, b) || moved;
      }
    }
    return moved;
  }

  private separateFootprints(a: number, b: number): boolean {
    const left = this.at(a);
    const right = this.at(b);
    const dx = right.slot.x - left.slot.x;
    const footprint =
      standingFootprint(left.member) +
      standingFootprint(right.member) +
      footprintGap;
    const minimum =
      left.kneels || right.kneels
        ? footprint * kneelerFootprintShare
        : footprint;
    const distance = Math.hypot(dx, right.slot.z - left.slot.z);
    if (distance >= minimum - 0.001) return false;
    const side = this.sideOf(dx, a);
    const push = (minimum - distance) / 2 + 0.01;
    this.shift(a, -side * push);
    this.shift(b, side * push);
    return true;
  }

  private clearSightline(a: number, b: number): boolean {
    const [frontIndex, behindIndex] =
      this.at(a).slot.z > this.at(b).slot.z ? [a, b] : [b, a];
    const front = this.at(frontIndex);
    const behind = this.at(behindIndex);
    if (front.slot.z - behind.slot.z < minRowDepth) return false;
    const frontBody = silhouetteOf(front);
    const behindBody = silhouetteOf(behind);
    const allowed = front.kneels ? kneelerCoverage : maxCoverage;
    if (coverage(frontBody, behindBody) <= allowed) return false;
    const clearance = lateralClearance(frontBody, behindBody, allowed * 0.85);
    if (clearance <= 0) return false;
    const away = this.awayFrom(front.slot.x, behind.slot.x);
    this.shift(frontIndex, away * (clearance * 0.65 + 0.01));
    this.shift(behindIndex, -away * (clearance * 0.35 + 0.01));
    return true;
  }

  /** Direction that moves `x` away from `otherX`; equal spots move outward. */
  private awayFrom(x: number, otherX: number): Side {
    if (Math.abs(x - otherX) < 0.001) return x <= 0 ? -1 : 1;
    return x > otherX ? 1 : -1;
  }

  private sideOf(dx: number, index: number): Side {
    if (Math.abs(dx) < 0.001) return index % 2 === 0 ? 1 : -1;
    return dx > 0 ? 1 : -1;
  }

  private center(): void {
    if (this.places.length === 0) return;
    const xs = this.places.map((place) => place.slot.x);
    const shift = -((Math.min(...xs) + Math.max(...xs)) / 2);
    if (Math.abs(shift) < 0.001) return;
    this.places = this.places.map((place) =>
      withSlot(place, place.slot.x + shift, place.slot.z),
    );
  }

  private shift(index: number, dx: number): void {
    const place = this.at(index);
    this.places[index] = withSlot(place, place.slot.x + dx, place.slot.z);
  }

  private at(index: number): TroopPlace {
    const place = this.places[index];
    if (!place) throw new RangeError(`no troop place ${String(index)}`);
    return place;
  }
}
