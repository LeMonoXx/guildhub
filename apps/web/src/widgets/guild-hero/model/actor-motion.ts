import {
  easeInOutQuad,
  facingCamera,
  facingToward,
  groundDistance,
  lerpPose,
  lerpRotation,
  type Rotation,
} from "./stage-motion";
import type { Pose } from "./stage-view";

/** Ground covered per second when stepping around on stage. */
const strideSpeed = 1.15;
const minTravelMs = 650;
/** Turning into the walk and back toward the camera. */
const turnMs = 380;

/**
 * One short walk on stage: wait, turn into the walk, cross to the target,
 * and turn back toward the camera. Times are scene elapsed milliseconds.
 */
export class ActorMotion {
  readonly departAt: number;
  readonly arriveAt: number;
  readonly doneAt: number;
  private readonly heading: Rotation;

  constructor(
    readonly from: Pose,
    readonly to: Pose,
    startAt: number,
    delayMs: number,
  ) {
    this.departAt = startAt + delayMs;
    const travelMs = Math.max(
      minTravelMs,
      (groundDistance(from, to) / strideSpeed) * 1000,
    );
    this.arriveAt = this.departAt + travelMs;
    this.doneAt = this.arriveAt + turnMs;
    this.heading = facingToward(from, to);
  }

  positionAt(nowMs: number): Pose {
    return lerpPose(this.from, this.to, easeInOutQuad(this.progress(nowMs)));
  }

  rotationAt(nowMs: number): Rotation {
    const turningIn = (nowMs - this.departAt) / turnMs;
    const turningBack = (nowMs - this.arriveAt) / turnMs;
    return nowMs < this.arriveAt
      ? lerpRotation(facingCamera, this.heading, easeInOutQuad(turningIn))
      : lerpRotation(this.heading, facingCamera, easeInOutQuad(turningBack));
  }

  isWalking(nowMs: number): boolean {
    return nowMs >= this.departAt && nowMs < this.arriveAt;
  }

  /** Milliseconds into the walk, for the walk clip. */
  walkedMs(nowMs: number): number {
    return Math.max(0, nowMs - this.departAt);
  }

  isDone(nowMs: number): boolean {
    return nowMs >= this.doneAt;
  }

  private progress(nowMs: number): number {
    return (nowMs - this.departAt) / (this.arriveAt - this.departAt);
  }
}
