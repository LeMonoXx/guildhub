import { readFogFigures } from "../fog-channel";
import { FigureMotionTracker } from "../fog-motion";
import { MAX_FIGURES } from "./fluid-shaders";
import type { Viewport } from "./splat-input";

/** Uv rectangle (y up): left, bottom, right, top. */
export interface Troop {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  ready: boolean;
}

type TroopBox = Omit<Troop, "ready">;

/** Where the characters stand (uv, y up) and how fast they move (grid cells per second). */
export class FigureSplats {
  /** Per figure: x, feet, head, half width. */
  readonly data = new Float32Array(MAX_FIGURES * 4);
  readonly velocity = new Float32Array(MAX_FIGURES * 2);
  count = 0;
  /** Where the troop stands. Off screen when nobody does. */
  readonly troop: Troop = { x0: 2, y0: 2, x1: 2, y1: 2, ready: false };
  private readonly tracker = new FigureMotionTracker();

  constructor(
    private readonly veilLayer: boolean,
    private readonly simWidth: number,
  ) {}

  update(
    dt: number,
    viewport: Viewport,
    simHeight: number,
    region: DOMRect | null,
  ) {
    const now = performance.now();
    const tracked = this.tracker.update(
      readFogFigures(now).slice(0, MAX_FIGURES),
      now,
      Math.min(dt, 1 / 20),
    );
    this.count = 0;
    for (const { figure, vx, vy } of tracked) {
      const x = figure.x / viewport.width;
      const feet = 1 - figure.feet / viewport.height;
      const head = 1 - figure.head / viewport.height;
      const halfWidth = figure.halfWidth / viewport.width;
      if (
        x + halfWidth * 3 < 0 ||
        x - halfWidth * 3 > 1 ||
        head < -0.1 ||
        feet > 1.1
      ) {
        continue;
      }
      const i = this.count;
      this.data.set([x, feet, head, halfWidth], i * 4);
      // px/s on screen (y down) to grid cells per second (y up).
      this.velocity.set(
        [
          (vx / viewport.width) * this.simWidth,
          (-vy / viewport.height) * simHeight,
        ],
        i * 2,
      );
      this.count += 1;
    }
    // Where the troop will stand, so the front fog is already there when the
    // characters walk in: wide across the stage, between its floor and head height.
    const box = region ?? {
      top: 0,
      bottom: viewport.height,
    };
    const boxHeight = Math.max(box.bottom - box.top, 1);
    const place = {
      x0: 0.06,
      x1: 0.94,
      y0: 1 - (box.top + boxHeight * 0.84) / viewport.height,
      y1: 1 - (box.top + boxHeight * 0.16) / viewport.height,
    };
    if (this.count === 0) {
      this.settleWithoutFigures(place, dt);
      return;
    }
    this.settle(this.figureBounds(place), dt);
  }

  private settleWithoutFigures(place: TroopBox, dt: number) {
    const troop = this.troop;
    if (!this.veilLayer) {
      troop.ready = false;
      troop.x0 = troop.y0 = troop.x1 = troop.y1 = 2;
      return;
    }
    if (!troop.ready) Object.assign(troop, { ...place, ready: true });
    const ease = 1 - Math.exp(-Math.min(dt, 1 / 20) / 0.5);
    troop.x0 += (place.x0 - troop.x0) * ease;
    troop.y0 += (place.y0 - troop.y0) * ease;
    troop.x1 += (place.x1 - troop.x1) * ease;
    troop.y1 += (place.y1 - troop.y1) * ease;
  }

  private figureBounds(place: TroopBox): TroopBox {
    let x0 = this.veilLayer ? Math.min(1, place.x0) : 1;
    let y0 = 1;
    let x1 = this.veilLayer ? Math.max(0, place.x1) : 0;
    let y1 = 0;
    for (let i = 0; i < this.count; i += 1) {
      const x = this.data[i * 4] ?? 0;
      const feet = this.data[i * 4 + 1] ?? 0;
      const head = this.data[i * 4 + 2] ?? 0;
      const halfWidth = this.data[i * 4 + 3] ?? 0;
      x0 = Math.min(x0, x - halfWidth);
      x1 = Math.max(x1, x + halfWidth);
      y0 = Math.min(y0, feet);
      y1 = Math.max(y1, head);
    }
    return { x0, y0, x1, y1 };
  }

  private settle(bounds: TroopBox, dt: number) {
    const troop = this.troop;
    if (!troop.ready) {
      Object.assign(troop, { ...bounds, ready: true });
    }
    const settle = 1 - Math.exp(-Math.min(dt, 1 / 20) / 0.5);
    troop.x0 += (bounds.x0 - troop.x0) * settle;
    troop.y0 += (bounds.y0 - troop.y0) * settle;
    troop.x1 += (bounds.x1 - troop.x1) * settle;
    troop.y1 += (bounds.y1 - troop.y1) * settle;
  }
}
