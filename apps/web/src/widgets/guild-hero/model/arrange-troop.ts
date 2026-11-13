import type { FeaturedMember } from "@guildhub/contracts";
import {
  isLargeRace,
  isSmallRace,
  raceStature,
} from "../../../entities/character";

const maxFeatured = 6;
const minPairDx = 0.58;
const minPairDistance = 1.05;
const kneelSideOffset = 0.4;
const kneelForward = 0.9;

export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TroopPlace {
  readonly member: FeaturedMember;
  readonly slot: Pose;
  readonly kneels: boolean;
}

interface Ranked {
  readonly member: FeaturedMember;
  readonly order: number;
  readonly stature: number;
}

const rowXs = (count: number, width: number): number[] => {
  if (count <= 1) return [0];
  return Array.from(
    { length: count },
    (_, index) => -width / 2 + (width * index) / (count - 1),
  );
};

const nudgeFrom = (x: number, avoidX: number | undefined): number => {
  if (avoidX === undefined) return x;
  const gap = x - avoidX;
  if (Math.abs(gap) >= 0.72) return x;
  const dir = gap === 0 ? 1 : Math.sign(gap);
  return avoidX + dir * 0.8;
};

const pickSpreadXs = (
  pool: readonly number[],
  count: number,
  fallbackWidth: number,
): number[] => {
  if (count <= 0) return [];
  if (pool.length === 0) return rowXs(count, fallbackWidth);
  const sorted = [...pool].sort((left, right) => left - right);
  if (sorted.length <= count) {
    if (sorted.length === count) return sorted;
    return rowXs(count, fallbackWidth);
  }
  if (count === 1) {
    const middle = sorted[Math.floor((sorted.length - 1) / 2)];
    return [middle ?? 0];
  }
  return Array.from({ length: count }, (_, index) => {
    const at = Math.round((index * (sorted.length - 1)) / (count - 1));
    return sorted[at] ?? 0;
  });
};

const staggeredFrontXs = (
  count: number,
  backXs: readonly number[],
  avoidX: number | undefined,
  fallbackWidth: number,
): number[] => {
  if (count <= 0) return [];
  const inner: number[] = [];
  for (let index = 0; index < backXs.length - 1; index += 1) {
    const left = backXs[index];
    const right = backXs[index + 1];
    if (left === undefined || right === undefined) continue;
    inner.push((left + right) / 2);
  }
  const first = backXs[0];
  const last = backXs.at(-1);
  const wings =
    inner.length >= count
      ? []
      : [
          ...(first === undefined ? [] : [first - 0.95]),
          ...(last === undefined ? [] : [last + 0.95]),
        ];
  const pool = [...inner, ...wings].map((x) => nudgeFrom(x, avoidX));
  return pickSpreadXs(pool, count, fallbackWidth);
};

const centerPlaces = (places: readonly TroopPlace[]): TroopPlace[] => {
  if (places.length === 0) return [];
  const xs = places.map((place) => place.slot.x);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const shift = -((min + max) / 2);
  if (Math.abs(shift) < 0.001) return [...places];
  return places.map((place) => ({
    ...place,
    slot: pose(place.slot.x + shift, place.slot.z),
  }));
};

const pickExtreme = (
  people: readonly Ranked[],
  prefer: (left: Ranked, right: Ranked) => boolean,
): Ranked | undefined => {
  let chosen = people[0];
  for (const person of people) {
    if (!chosen || prefer(person, chosen)) chosen = person;
  }
  return chosen;
};

const pose = (x: number, z: number): Pose => ({ x, y: 0, z });

const distanceXz = (left: Pose, right: Pose): number =>
  Math.hypot(right.x - left.x, right.z - left.z);

const offsetSign = (behindX: number, occupied: readonly number[]): number => {
  const leftClearance = occupied.reduce(
    (clearance, x) =>
      x < behindX ? Math.min(clearance, behindX - x) : clearance,
    3,
  );
  const rightClearance = occupied.reduce(
    (clearance, x) =>
      x > behindX ? Math.min(clearance, x - behindX) : clearance,
    3,
  );
  return rightClearance >= leftClearance ? 1 : -1;
};

const separatePlaces = (places: readonly TroopPlace[]): TroopPlace[] => {
  const next = places.map((place) => ({
    ...place,
    slot: { ...place.slot },
  }));
  for (let pass = 0; pass < 8; pass += 1) {
    for (let leftIndex = 0; leftIndex < next.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < next.length;
        rightIndex += 1
      ) {
        const left = next[leftIndex];
        const right = next[rightIndex];
        if (!left || !right) continue;
        const dx = right.slot.x - left.slot.x;
        const dist = distanceXz(left.slot, right.slot);
        const tooCloseX = Math.abs(dx) < minPairDx;
        const tooClose = dist < minPairDistance;
        if (!tooCloseX && !tooClose) continue;
        const lateral =
          Math.abs(dx) < 0.001 ? (leftIndex % 2 === 0 ? 1 : -1) : Math.sign(dx);
        const gap = tooCloseX
          ? (minPairDx - Math.abs(dx)) / 2 + 0.04
          : (minPairDistance - dist) / 2 + 0.03;
        next[leftIndex] = {
          ...left,
          slot: pose(left.slot.x - lateral * gap, left.slot.z),
        };
        next[rightIndex] = {
          ...right,
          slot: pose(right.slot.x + lateral * gap, right.slot.z),
        };
      }
    }
  }
  return next;
};

export const arrangeTroop = (
  members: readonly FeaturedMember[],
): readonly TroopPlace[] => {
  const ranked: Ranked[] = members.slice(0, maxFeatured).map((member, order) => ({
    member,
    order,
    stature: raceStature(member.raceId),
  }));
  if (ranked.length === 0) return [];

  const large = ranked.filter((person) => isLargeRace(person.member.raceId));
  const small = ranked.filter((person) => isSmallRace(person.member.raceId));
  const anchor = pickExtreme(
    large,
    (left, right) =>
      left.stature > right.stature ||
      (left.stature === right.stature && left.order < right.order),
  );
  const kneeler =
    anchor &&
    pickExtreme(
      small,
      (left, right) =>
        left.stature < right.stature ||
        (left.stature === right.stature && left.order < right.order),
    );

  const rest = ranked.filter((person) => person !== kneeler);
  const back: Ranked[] = [];
  const front: Ranked[] = [];
  for (const person of rest) {
    if (isLargeRace(person.member.raceId)) back.push(person);
  }
  for (const person of rest) {
    if (isSmallRace(person.member.raceId)) front.push(person);
  }
  const mediums = rest
    .filter(
      (person) =>
        !isLargeRace(person.member.raceId) &&
        !isSmallRace(person.member.raceId),
    )
    .sort(
      (left, right) =>
        right.stature - left.stature || left.order - right.order,
    );
  for (const person of mediums) {
    if (back.length <= front.length) back.push(person);
    else front.push(person);
  }

  const byOrder = (left: Ranked, right: Ranked) => left.order - right.order;
  back.sort(byOrder);
  front.sort(byOrder);

  const backZ = 0.04;
  const frontZ = 1.52;
  const backWidth = Math.max(6.8, (back.length - 1) * 3.4);
  const frontWidth = Math.max(5.2, (front.length - 1) * 2.7);
  const places: TroopPlace[] = [];

  back.forEach((person, index) => {
    const x = rowXs(back.length, backWidth)[index] ?? 0;
    places.push({
      member: person.member,
      slot: pose(x, backZ + (index % 2 === 0 ? 0 : 0.16)),
      kneels: false,
    });
  });

  let behind: TroopPlace | undefined;
  if (anchor !== undefined && kneeler !== undefined) {
    behind = places.find((place) => place.member === anchor.member);
  }
  const backXs = places.map((place) => place.slot.x);
  const kneelX =
    behind === undefined
      ? undefined
      : behind.slot.x +
        offsetSign(behind.slot.x, backXs) * kneelSideOffset;
  const frontXs = staggeredFrontXs(
    front.length,
    backXs,
    kneelX,
    frontWidth,
  );

  front.forEach((person, index) => {
    const x = frontXs[index] ?? 0;
    places.push({
      member: person.member,
      slot: pose(x, frontZ + (index % 2 === 0 ? 0 : 0.1)),
      kneels: false,
    });
  });

  if (kneeler && behind) {
    places.push({
      member: kneeler.member,
      slot: pose(
        behind.slot.x + offsetSign(behind.slot.x, backXs) * kneelSideOffset,
        behind.slot.z + kneelForward,
      ),
      kneels: true,
    });
  }

  return centerPlaces(separatePlaces(places));
};
