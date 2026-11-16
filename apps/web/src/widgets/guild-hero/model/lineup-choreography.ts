import {
  mapCommands,
  type CinematicFrame,
  type FrameCommand,
  type FrameDecorator,
} from "../../../shared/cinematic";

import { ActorMotion } from "./actor-motion";
import { stagePlanFor, type StagePlan } from "./stage-plan";
import { actorTransform, clipValue, groundDistance } from "./stage-motion";
import type { Pose } from "./stage-view";
import type { TroopPlace } from "./troop-place";

/** The authored phase the lineup is in once everyone stands. */
const assembledPhase = "hold";
const walkCrossfadeMs = 220;
const arrivedWithin = 0.01;

type Override = (
  command: FrameCommand,
  motion: ActorMotion,
  nowMs: number,
) => FrameCommand;

/** How each kind of command changes while an actor steps around. */
const overrides: Readonly<Record<string, Override>> = {
  transform: (command, motion, nowMs) => ({
    ...command,
    value: actorTransform(motion.positionAt(nowMs), motion.rotationAt(nowMs)),
  }),
  clip: (command, motion, nowMs) =>
    motion.isWalking(nowMs)
      ? {
          ...command,
          value: {
            ...clipValue("Walk", `${command.target}-step`, {
              crossfadeMs: walkCrossfadeMs,
            }),
            localTimeMs: motion.walkedMs(nowMs),
          },
        }
      : command,
};

/**
 * Lets one member of the assembled lineup step forward while the others
 * make way, on top of the authored scene. It only acts once the lineup has
 * assembled, and only changes the actors that are on the move.
 */
export class LineupChoreography implements FrameDecorator {
  private readonly motions = new Map<string, ActorMotion>();
  private readonly listeners = new Set<() => void>();
  private selected: string | undefined;
  private pending: StagePlan | undefined;
  private assembled = false;

  constructor(private readonly places: readonly TroopPlace[]) {}

  get isAssembled(): boolean {
    return this.assembled;
  }

  /** Where everyone will stand for a selection; also used to place the hover targets. */
  planFor(slug: string | undefined): StagePlan {
    return stagePlanFor(this.places, slug, this.selected);
  }

  select(slug: string | undefined): void {
    if (slug === this.selected) return;
    this.pending = this.planFor(slug);
    this.selected = slug;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  decorate(frame: CinematicFrame): CinematicFrame {
    if (frame.phase.id !== assembledPhase) {
      this.rewind();
      return frame;
    }
    this.markAssembled();
    const nowMs = frame.elapsedMs;
    this.start(nowMs);
    this.settle(nowMs);
    if (this.motions.size === 0) return frame;
    return mapCommands(frame, (command) => this.override(command, nowMs));
  }

  private start(nowMs: number): void {
    const plan = this.pending;
    if (!plan) return;
    this.pending = undefined;
    for (const place of this.places) {
      const slug = place.member.slug;
      const from = this.poseOf(place, nowMs);
      const to = plan.targetOf(slug);
      if (groundDistance(from, to) < arrivedWithin) {
        this.cancelHeadingElsewhere(place, to);
        continue;
      }
      this.motions.set(
        slug,
        new ActorMotion(from, to, nowMs, plan.startDelayOf(slug)),
      );
    }
  }

  /**
   * Someone still waiting to set off may already stand where the new plan
   * wants them; their old walk must not start anyway.
   */
  private cancelHeadingElsewhere(place: TroopPlace, to: Pose): void {
    const motion = this.motions.get(place.member.slug);
    if (
      motion &&
      groundDistance(motion.to, to) >= arrivedWithin &&
      groundDistance(to, place.slot) < arrivedWithin
    )
      this.motions.delete(place.member.slug);
  }

  /** Finished walks back home hand the actor back to the authored scene. */
  private settle(nowMs: number): void {
    for (const place of this.places) {
      const motion = this.motions.get(place.member.slug);
      if (
        motion?.isDone(nowMs) &&
        groundDistance(motion.to, place.slot) < arrivedWithin
      )
        this.motions.delete(place.member.slug);
    }
  }

  private poseOf(place: TroopPlace, nowMs: number): Pose {
    return this.motions.get(place.member.slug)?.positionAt(nowMs) ?? place.slot;
  }

  private override(command: FrameCommand, nowMs: number): FrameCommand {
    const motion = this.motions.get(command.target);
    const override = overrides[command.kind];
    return motion && override ? override(command, motion, nowMs) : command;
  }

  /** A replayed entrance starts from the slots; the selection steps out again afterwards. */
  private rewind(): void {
    if (!this.assembled) return;
    this.motions.clear();
    this.pending = stagePlanFor(this.places, this.selected);
    this.setAssembled(false);
  }

  private markAssembled(): void {
    if (!this.assembled) this.setAssembled(true);
  }

  private setAssembled(assembled: boolean): void {
    this.assembled = assembled;
    for (const listener of this.listeners) listener();
  }
}
