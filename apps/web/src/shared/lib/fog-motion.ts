import type { FogFigure } from "./fog-channel";

/** How a body moves, smoothed so the fog never jerks. Viewport pixels. */
export interface FigureMotion {
  readonly figure: FogFigure;
  /** Velocity in px/s, eased toward the measured value. */
  readonly vx: number;
  readonly vy: number;
  /** Accumulated drag: how far the fog near the body has been pulled along, easing back to zero. */
  readonly dragX: number;
  readonly dragY: number;
  readonly speed: number;
}

interface Track {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dragX: number;
  dragY: number;
  /** When the reported position last changed. */
  changedAt: number;
}

/** Seconds for the velocity to settle on a new value. */
const velocityEase = 0.18;
/** Seconds for pulled fog to drift back. */
const dragRelax = 0.9;
const maxSpeed = 700;
const maxDrag = 180;

/**
 * Turns the stage's position reports into smooth motion. Reports and frames
 * arrive on different clocks, so a velocity is measured only when a position
 * really changes (over the time since the last change) and then eased; a body
 * that stops reporting changes slows down smoothly instead of snapping to zero.
 */
export class FigureMotionTracker {
  private readonly tracks = new Map<string, Track>();

  update(
    figures: readonly FogFigure[],
    now: number,
    dt: number,
  ): readonly FigureMotion[] {
    const seen = new Set<string>();
    const result: FigureMotion[] = [];
    const ease = 1 - Math.exp(-dt / velocityEase);
    const relax = Math.exp(-dt / dragRelax);

    for (const figure of figures) {
      seen.add(figure.id);
      let track = this.tracks.get(figure.id);
      if (!track) {
        track = {
          x: figure.x,
          y: figure.feet,
          vx: 0,
          vy: 0,
          dragX: 0,
          dragY: 0,
          changedAt: now,
        };
        this.tracks.set(figure.id, track);
      }

      let targetX = track.vx;
      let targetY = track.vy;
      const moved = figure.x !== track.x || figure.feet !== track.y;
      const since = (now - track.changedAt) / 1000;
      if (moved && since > 0) {
        targetX = (figure.x - track.x) / since;
        targetY = (figure.feet - track.y) / since;
        track.x = figure.x;
        track.y = figure.feet;
        track.changedAt = now;
      } else if (since > 0.25) {
        // No new position for a while: the body has stopped.
        targetX = 0;
        targetY = 0;
      }
      const targetSpeed = Math.hypot(targetX, targetY);
      if (targetSpeed > maxSpeed) {
        targetX *= maxSpeed / targetSpeed;
        targetY *= maxSpeed / targetSpeed;
      }
      track.vx += (targetX - track.vx) * ease;
      track.vy += (targetY - track.vy) * ease;

      track.dragX = (track.dragX + track.vx * dt) * relax;
      track.dragY = (track.dragY + track.vy * dt) * relax;
      const drag = Math.hypot(track.dragX, track.dragY);
      if (drag > maxDrag) {
        track.dragX *= maxDrag / drag;
        track.dragY *= maxDrag / drag;
      }

      result.push({
        figure,
        vx: track.vx,
        vy: track.vy,
        dragX: track.dragX,
        dragY: track.dragY,
        speed: Math.hypot(track.vx, track.vy),
      });
    }
    for (const id of this.tracks.keys()) {
      if (!seen.has(id)) this.tracks.delete(id);
    }
    return result;
  }
}
