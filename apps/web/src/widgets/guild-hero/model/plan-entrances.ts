import { easeOutQuad, lerpPose } from "./stage-motion";
import type { Pose } from "./stage-view";

export type ApproachSide = "left" | "right" | "back";

export interface EntranceInput {
  readonly slot: Pose;
  /** Ground radius while walking, gear included. */
  readonly radius: number;
  readonly travelMs: number;
}

export interface Entrance {
  readonly side: ApproachSide;
  readonly start: Pose;
  /** Shows up at the start; back entrances arrive by teleport before they walk. */
  readonly appearAt: number;
  readonly enterAt: number;
  readonly settledAt: number;
}

interface Path extends EntranceInput {
  readonly side: ApproachSide;
  readonly start: Pose;
  readonly standMs: number;
}

interface Scheduled {
  readonly index: number;
  readonly enterAt: number;
}

/** Back entrances fan out from this point far behind the stage. */
const vanishingPoint: Pose = { x: 0, y: 0, z: -9 };
const backDepth = 2.9;
const sideDistance = 6.2;
/** Leaves room for the first teleport to charge before anyone walks. */
const firstEntranceMs = 1300;
const minStaggerMs = 950;
const delayStepMs = 60;
const maxDelayMs = 9000;
const sampleMs = 40;
/** Bodies may brush shoulders while walking, never overlap. */
const walkClearance = 0.92;

const startBySide: Readonly<Record<ApproachSide, (slot: Pose) => Pose>> = {
  left: (slot) => ({ x: slot.x - sideDistance, y: 0, z: slot.z }),
  right: (slot) => ({ x: slot.x + sideDistance, y: 0, z: slot.z }),
  back: (slot) => {
    const scale = backDepth / (slot.z - vanishingPoint.z);
    return {
      x: slot.x - (slot.x - vanishingPoint.x) * scale,
      y: 0,
      z: slot.z - backDepth,
    };
  },
};

/** Side entrances walk in from off stage; back entrances stand in the teleport light first. */
const standBySide: Readonly<Record<ApproachSide, number>> = {
  left: 0,
  right: 0,
  back: 520,
};

export const approachStart = (slot: Pose, side: ApproachSide): Pose =>
  startBySide[side](slot);

export const arrivesByTeleport = (entrance: Entrance): boolean =>
  entrance.appearAt < entrance.enterAt;

/** The outermost actors enter from their side, everyone else from the back. */
export const approachSides = (slots: readonly Pose[]): ApproachSide[] => {
  const sides = slots.map((): ApproachSide => "back");
  if (slots.length <= 1) return sides;
  const xs = slots.map((slot) => slot.x);
  sides[xs.indexOf(Math.min(...xs))] = "left";
  sides[xs.indexOf(Math.max(...xs))] = "right";
  return sides;
};

const distance = (left: Pose, right: Pose) =>
  Math.hypot(left.x - right.x, left.z - right.z);

/**
 * Orders entrances so nobody walks through someone already standing, then
 * delays each start until its whole walk stays clear of everyone else.
 */
export class EntrancePlanner {
  private readonly paths: readonly Path[];

  constructor(actors: readonly EntranceInput[]) {
    const sides = approachSides(actors.map((actor) => actor.slot));
    this.paths = actors.map((actor, index) => {
      const side = sides[index] ?? "back";
      return {
        ...actor,
        side,
        start: approachStart(actor.slot, side),
        standMs: standBySide[side],
      };
    });
  }

  plan(): Entrance[] {
    const scheduled = this.schedule(this.walkOrder());
    return this.paths.map((path, index) => {
      const enterAt =
        scheduled.find((entry) => entry.index === index)?.enterAt ??
        firstEntranceMs;
      return {
        side: path.side,
        start: path.start,
        appearAt: enterAt - path.standMs,
        enterAt,
        settledAt: enterAt + path.travelMs,
      };
    });
  }

  private schedule(order: readonly number[]): Scheduled[] {
    const scheduled: Scheduled[] = [];
    let earliest = firstEntranceMs;
    for (const index of order) {
      const path = this.path(index);
      let enterAt = earliest;
      while (
        enterAt - earliest < maxDelayMs &&
        this.collides(path, enterAt, scheduled)
      ) {
        enterAt += delayStepMs;
      }
      scheduled.push({ index, enterAt });
      earliest = enterAt + minStaggerMs;
    }
    return scheduled;
  }

  /**
   * Topological order over "walks through the spot of" edges, keeping the
   * given order where the edges leave a choice. Cycles fall back to that order.
   */
  private walkOrder(): number[] {
    const indices = this.paths.map((_, index) => index);
    const mustPrecede = indices.map((walker) =>
      indices.filter(
        (stander) => stander !== walker && this.crossesSpot(walker, stander),
      ),
    );
    const waiting = indices.map(
      (index) => mustPrecede.filter((after) => after.includes(index)).length,
    );
    const order: number[] = [];
    while (order.length < indices.length) {
      const open = indices.filter((index) => !order.includes(index));
      const ready = open.find((index) => waiting[index] === 0) ?? open[0];
      if (ready === undefined) break;
      order.push(ready);
      for (const other of mustPrecede[ready] ?? []) {
        waiting[other] = (waiting[other] ?? 0) - 1;
      }
    }
    return order;
  }

  /**
   * `true` when the walker passes through the spot where the stander will
   * stand, so the walker has to be through first. Spots beyond the walker's
   * slot do not count: it stops before them.
   */
  private crossesSpot(walkerIndex: number, standerIndex: number): boolean {
    const walker = this.path(walkerIndex);
    const stander = this.path(standerIndex);
    const vx = walker.slot.x - walker.start.x;
    const vz = walker.slot.z - walker.start.z;
    const length = vx * vx + vz * vz;
    if (length === 0) return false;
    const t =
      ((stander.slot.x - walker.start.x) * vx +
        (stander.slot.z - walker.start.z) * vz) /
      length;
    if (t >= 1) return false;
    const closest = lerpPose(walker.start, walker.slot, Math.max(0, t));
    return (
      distance(stander.slot, closest) <
      (walker.radius + stander.radius) * walkClearance
    );
  }

  private collides(
    path: Path,
    enterAt: number,
    scheduled: readonly Scheduled[],
  ): boolean {
    const appearAt = enterAt - path.standMs;
    for (
      let time = appearAt;
      time <= enterAt + path.travelMs;
      time += sampleMs
    ) {
      const here = this.positionAt(path, enterAt, time);
      if (!here) continue;
      const blocked = scheduled.some((other) => {
        const otherPath = this.path(other.index);
        const there = this.positionAt(otherPath, other.enterAt, time);
        return (
          there !== undefined &&
          distance(here, there) < this.allowedDistance(path, otherPath)
        );
      });
      if (blocked) return true;
    }
    return false;
  }

  /**
   * How close two walkers may get. People placed closer than that on
   * purpose, like someone kneeling in front of a taller friend, may close to
   * their planned distance.
   */
  private allowedDistance(left: Path, right: Path): number {
    return Math.min(
      (left.radius + right.radius) * walkClearance,
      distance(left.slot, right.slot) * 0.97,
    );
  }

  /** Standing at the start counts as being there; before appearing, nobody is. */
  private positionAt(
    path: Path,
    enterAt: number,
    timeMs: number,
  ): Pose | undefined {
    if (timeMs < enterAt - path.standMs) return undefined;
    return lerpPose(
      path.start,
      path.slot,
      easeOutQuad((timeMs - enterAt) / path.travelMs),
    );
  }

  private path(index: number): Path {
    const path = this.paths[index];
    if (!path) throw new RangeError(`no entrance path ${String(index)}`);
    return path;
  }
}

export const planEntrances = (actors: readonly EntranceInput[]): Entrance[] =>
  new EntrancePlanner(actors).plan();
