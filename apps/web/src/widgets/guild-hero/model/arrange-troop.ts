import type { FeaturedMember } from "@guildhub/contracts";
import {
  isLargeRace,
  isSmallRace,
  raceStature,
} from "../../../entities/character";
import { gearReachOf, standingFootprint } from "./gear-reach";
import { SpacingResolver } from "./spacing-resolver";
import { groundPose, type TroopPlace } from "./troop-place";

export type { Pose } from "./stage-view";
export { maxCoverage } from "./spacing-resolver";
export { silhouetteOf, type TroopPlace } from "./troop-place";

const maxFeatured = 8;
const pairGap = 0.32;
const rowGap = 1.18;
const backZ = 0.04;
const rowStagger = { back: 0.12, front: 0.08 } as const;
const outerGapFallback = 0.4;
const kneelGapAvoidance = 0.55;
const overflowStep = 0.9;

interface Ranked {
  readonly member: FeaturedMember;
  readonly order: number;
  readonly stature: number;
}

type StatureClass = "large" | "small" | "medium";

const statureClassOf = (member: FeaturedMember): StatureClass => {
  if (isLargeRace(member.raceId)) return "large";
  return isSmallRace(member.raceId) ? "small" : "medium";
};

const byOrder = (left: Ranked, right: Ranked) => left.order - right.order;

const pickExtreme = (
  people: readonly Ranked[],
  prefer: (left: Ranked, right: Ranked) => boolean,
): Ranked | undefined =>
  people.reduce<Ranked | undefined>(
    (chosen, person) => (!chosen || prefer(person, chosen) ? person : chosen),
    undefined,
  );

const tallest = (left: Ranked, right: Ranked) =>
  left.stature > right.stature ||
  (left.stature === right.stature && left.order < right.order);

const shortest = (left: Ranked, right: Ranked) =>
  left.stature < right.stature ||
  (left.stature === right.stature && left.order < right.order);

/** Centers of footprints laid side by side with a gap between them. */
const packedXs = (radii: readonly number[]): number[] => {
  const xs = radii.reduce<number[]>((placed, radius, index) => {
    const previous = placed.at(-1);
    const left = radii[index - 1] ?? 0;
    return [
      ...placed,
      previous === undefined ? 0 : previous + left + pairGap + radius,
    ];
  }, []);
  const shift = ((xs[0] ?? 0) + (xs.at(-1) ?? 0)) / 2;
  return xs.map((x) => x - shift);
};

/** The side of `x` with more free room among `occupied`. */
const roomierSide = (x: number, occupied: readonly number[]): 1 | -1 => {
  const clearance = (side: 1 | -1) =>
    occupied.reduce(
      (best, other) =>
        Math.sign(other - x) === side
          ? Math.min(best, Math.abs(other - x))
          : best,
      3,
    );
  return clearance(1) >= clearance(-1) ? 1 : -1;
};

/**
 * Splits the cast into rows: large races at the back, small ones in front,
 * medium ones filling whichever row is shorter. With a large and a small
 * race present, the smallest kneels in front of the largest.
 */
class TroopRoster {
  readonly back: Ranked[];
  readonly front: Ranked[];
  readonly kneeler: Ranked | undefined;
  readonly anchor: Ranked | undefined;

  constructor(members: readonly FeaturedMember[]) {
    const ranked = members.slice(0, maxFeatured).map((member, order) => ({
      member,
      order,
      stature: raceStature(member.raceId),
    }));
    const byClass = (statureClass: StatureClass) =>
      ranked.filter((person) => statureClassOf(person.member) === statureClass);
    const anchor = pickExtreme(byClass("large"), tallest);
    this.anchor = anchor;
    this.kneeler = anchor && pickExtreme(byClass("small"), shortest);
    const rest = ranked.filter((person) => person !== this.kneeler);
    this.back = rest.filter(
      (person) => statureClassOf(person.member) === "large",
    );
    this.front = rest.filter(
      (person) => statureClassOf(person.member) === "small",
    );
    const mediums = rest
      .filter((person) => statureClassOf(person.member) === "medium")
      .sort(
        (left, right) =>
          right.stature - left.stature || left.order - right.order,
      );
    for (const person of mediums) {
      (this.back.length <= this.front.length ? this.back : this.front).push(
        person,
      );
    }
    this.back.sort(byOrder);
    this.front.sort(byOrder);
  }
}

const placeBackRow = (people: readonly Ranked[]): TroopPlace[] => {
  const xs = packedXs(people.map((person) => standingFootprint(person.member)));
  return people.map((person, index) => ({
    member: person.member,
    slot: groundPose(
      xs[index] ?? 0,
      backZ + (index % 2 === 0 ? 0 : rowStagger.back),
    ),
    kneels: false,
  }));
};

/** Extra depth someone at `x` needs to stay clear of gear on the back row. */
const gearDepthAt = (
  x: number,
  member: FeaturedMember,
  back: readonly TroopPlace[],
): number =>
  back
    .filter(
      (place) =>
        Math.abs(place.slot.x - x) <
        standingFootprint(place.member) + standingFootprint(member),
    )
    .reduce(
      (deepest, place) => Math.max(deepest, gearReachOf(place.member).depth),
      0,
    );

/**
 * Front-row people start in the gaps between the back row so faces stay
 * visible; the most central gaps fill first.
 */
const placeFrontRow = (
  people: readonly Ranked[],
  back: readonly TroopPlace[],
  avoidX: number | undefined,
): TroopPlace[] => {
  const z = backZ + rowGap;
  const backXs = back.map((place) => place.slot.x).sort((a, b) => a - b);
  const between = backXs
    .slice(1)
    .map((x, index) => ((backXs[index] ?? 0) + x) / 2);
  const outer = Math.max(
    ...back.map((place) => standingFootprint(place.member)),
    outerGapFallback,
  );
  const edges =
    backXs.length > 0
      ? [(backXs[0] ?? 0) - outer, (backXs.at(-1) ?? 0) + outer]
      : [0];
  const free = [...between, ...edges]
    .filter(
      (x) => avoidX === undefined || Math.abs(x - avoidX) > kneelGapAvoidance,
    )
    .sort((a, b) => Math.abs(a) - Math.abs(b));
  const chosen = free.slice(0, people.length).sort((a, b) => a - b);
  while (chosen.length < people.length) {
    chosen.push((chosen.at(-1) ?? 0) + overflowStep);
  }
  return people.map((person, index) => {
    const x = chosen[index] ?? 0;
    const stagger = index % 2 === 0 ? 0 : rowStagger.front;
    return {
      member: person.member,
      slot: groundPose(x, z + stagger + gearDepthAt(x, person.member, back)),
      kneels: false,
    };
  });
};

/** Where the kneeler goes: just beside and in front of the one behind. */
const kneelSpot = (
  kneeler: Ranked,
  behind: TroopPlace,
  backRow: readonly TroopPlace[],
) => {
  const reach = gearReachOf(behind.member);
  const side = roomierSide(
    behind.slot.x,
    backRow.map((place) => place.slot.x),
  );
  const offset =
    Math.max(0.32, standingFootprint(behind.member) * 0.42) + reach.side;
  return groundPose(
    behind.slot.x + side * offset,
    behind.slot.z +
      0.52 +
      reach.depth +
      standingFootprint(kneeler.member) * 0.35,
  );
};

export const arrangeTroop = (
  members: readonly FeaturedMember[],
): readonly TroopPlace[] => {
  if (members.length === 0) return [];
  const roster = new TroopRoster(members);
  const backRow = placeBackRow(roster.back);
  const behind =
    roster.kneeler === undefined
      ? undefined
      : backRow.find((place) => place.member === roster.anchor?.member);
  const kneel =
    roster.kneeler && behind
      ? kneelSpot(roster.kneeler, behind, backRow)
      : undefined;
  const places: TroopPlace[] = [
    ...backRow,
    ...placeFrontRow(roster.front, backRow, kneel?.x),
  ];
  if (roster.kneeler && kneel) {
    places.push({ member: roster.kneeler.member, slot: kneel, kneels: true });
  }
  return new SpacingResolver(places).resolve();
};
