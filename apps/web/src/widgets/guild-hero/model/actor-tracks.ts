import { teleportFlashProgress } from "@guildhub/contracts";
import { gearReachOf } from "./gear-reach";
import { arrivesByTeleport, type Entrance } from "./plan-entrances";
import { settleRoutineFor, type ClipKeyframe } from "./settle-routines";
import {
  actorTransform,
  clipValue,
  facingCamera,
  facingToward,
  type ActorTransform,
} from "./stage-motion";
import type { TroopPlace } from "./troop-place";
import type { WalkFlavor } from "./walk-flavor";

/** Pause between arriving and planting the feet. */
const plantDelayMs = 280;
/** How long the turn toward the camera takes once planted. */
const turnMs = 420;
/** How long before reaching the slot the legs stop walking. */
const stopLeadMs = 700;
/** Extra lead per stage unit that gear swings ahead while walking. */
const gearStopLeadMsPerUnit = 1400;
/** The blend from the arrival stance into the first steps. */
const walkInMs = 320;
/** Charge, flash and fade of one arrival. */
const teleportMs = 1500;
const arcaneTint = { x: 0.45, y: 0.68, z: 1 };

/**
 * The three tracks one actor needs: what it plays, where it is, and when it
 * shows. It walks in once and then stays; the lineup does not loop.
 */
export class ActorTrackBuilder {
  private readonly slug: string;
  private readonly plantedAt: number;
  private readonly facedAt: number;

  constructor(
    private readonly place: TroopPlace,
    private readonly flavor: WalkFlavor,
    private readonly entrance: Entrance,
  ) {
    this.slug = place.member.slug;
    this.plantedAt = entrance.settledAt + plantDelayMs;
    this.facedAt = this.plantedAt + turnMs;
  }

  build() {
    return [
      this.clipTrack(),
      this.transformTrack(),
      this.visibilityTrack(),
      ...this.teleportTracks(),
    ];
  }

  private clipTrack() {
    const arrive: ClipKeyframe = {
      timeMs: 0,
      value: clipValue(this.flavor.arrival, `${this.slug}-arrive`),
    };
    const walk: ClipKeyframe = {
      timeMs: this.entrance.enterAt,
      value: clipValue(this.flavor.clip, `${this.slug}-enter`, {
        rate: this.flavor.rate,
        crossfadeMs: walkInMs,
      }),
    };
    const settle = settleRoutineFor(this.place).clips(this.place.member, {
      settledAt: this.stopsWalkingAt(),
      facedAt: this.facedAt,
    });
    return {
      kind: "clip" as const,
      id: `${this.slug}-clips`,
      target: this.slug,
      keyframes: [arrive, walk, ...settle],
    };
  }

  /**
   * The walk eases out, so its last steps barely move. The legs stop before
   * the slot, and gear held out front (a shield) comes down earlier still,
   * so it never hangs over whoever already stands in front.
   */
  private stopsWalkingAt(): number {
    const lead =
      stopLeadMs +
      gearReachOf(this.place.member).stride * gearStopLeadMsPerUnit;
    return Math.max(this.entrance.enterAt, this.entrance.settledAt - lead);
  }

  private transformTrack() {
    const { start, enterAt, settledAt } = this.entrance;
    const heading = facingToward(start, this.place.slot);
    const offstage = actorTransform(start, heading);
    const walking = actorTransform(this.place.slot, heading);
    const onstage = actorTransform(this.place.slot, facingCamera);
    const keyframe = (
      timeMs: number,
      value: ActorTransform,
      easing?: "ease-out" | "ease-in-out",
    ) => ({ timeMs, value, ...(easing === undefined ? {} : { easing }) });
    return {
      kind: "transform" as const,
      id: `${this.slug}-transform`,
      target: this.slug,
      keyframes: [
        keyframe(0, offstage),
        keyframe(enterAt, offstage),
        keyframe(settledAt, walking, "ease-out"),
        keyframe(this.plantedAt, walking),
        keyframe(this.facedAt, onstage, "ease-in-out"),
      ],
    };
  }

  private visibilityTrack() {
    return {
      kind: "visibility" as const,
      id: `${this.slug}-visibility`,
      target: this.slug,
      keyframes: [
        { timeMs: 0, value: false },
        { timeMs: this.entrance.appearAt, value: true },
      ],
    };
  }

  /** The hero appears under the flash, so the light charges up before `appearAt`. */
  private teleportTracks() {
    if (!arrivesByTeleport(this.entrance)) return [];
    const position = this.entrance.start;
    const beginsAt =
      this.entrance.appearAt - teleportMs * teleportFlashProgress;
    const endsAt = beginsAt + teleportMs;
    return [
      {
        kind: "teleport" as const,
        id: `${this.slug}-teleport`,
        target: this.slug,
        keyframes: [
          {
            timeMs: beginsAt,
            value: { position, progress: 0, tint: arcaneTint },
          },
          {
            timeMs: endsAt,
            value: { position, progress: 1, tint: arcaneTint },
          },
        ],
      },
    ];
  }
}
