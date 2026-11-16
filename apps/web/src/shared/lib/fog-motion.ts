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
/** Seconds without a new position before a body counts as stopped. */
const stoppedAfter = 0.25;
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
      const track = this.trackFor(figure, now);
      const [targetX, targetY] = clampLength(
        measureVelocity(track, figure, now),
        maxSpeed,
      );
      track.vx += (targetX - track.vx) * ease;
      track.vy += (targetY - track.vy) * ease;
      [track.dragX, track.dragY] = clampLength(
        [
          (track.dragX + track.vx * dt) * relax,
          (track.dragY + track.vy * dt) * relax,
        ],
        maxDrag,
      );

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

  private trackFor(figure: FogFigure, now: number): Track {
    const known = this.tracks.get(figure.id);
    if (known) return known;
    const track = {
      x: figure.x,
      y: figure.feet,
      vx: 0,
      vy: 0,
      dragX: 0,
      dragY: 0,
      changedAt: now,
    };
    this.tracks.set(figure.id, track);
    return track;
  }
}

/** The velocity to ease toward; records the position when it changed. */
function measureVelocity(
  track: Track,
  figure: FogFigure,
  now: number,
): [number, number] {
  const since = (now - track.changedAt) / 1000;
  const moved = figure.x !== track.x || figure.feet !== track.y;
  if (moved && since > 0) {
    const velocity: [number, number] = [
      (figure.x - track.x) / since,
      (figure.feet - track.y) / since,
    ];
    track.x = figure.x;
    track.y = figure.feet;
    track.changedAt = now;
    return velocity;
  }
  if (since > stoppedAfter) return [0, 0];
  return [track.vx, track.vy];
}

function clampLength(
  [x, y]: readonly [number, number],
  max: number,
): [number, number] {
  const length = Math.hypot(x, y);
  return length > max ? [(x * max) / length, (y * max) / length] : [x, y];
}
