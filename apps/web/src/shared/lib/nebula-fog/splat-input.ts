export interface Viewport {
  width: number;
  height: number;
}

/** The pointer in uv (y up) and how far it moved since the last step. */
export class PointerSplat {
  x = 0.5;
  y = 0.5;
  dx = 0;
  dy = 0;
  on = false;
  moved = false;

  constructor(private readonly viewport: Viewport) {}

  readonly onMove = (event: PointerEvent) => {
    const x = event.clientX / this.viewport.width;
    const y = 1 - event.clientY / this.viewport.height;
    if (this.on) {
      this.dx += x - this.x;
      this.dy += y - this.y;
    }
    this.x = x;
    this.y = y;
    this.on = true;
    this.moved = true;
  };

  readonly onLeave = () => {
    this.on = false;
  };

  consume() {
    this.dx = 0;
    this.dy = 0;
    this.moved = false;
  }
}

/** Scroll travel since the last step, as a vertical push on the fog. */
export class ScrollSplat {
  push = 0;
  private last = globalThis.scrollY;

  sample() {
    const scroll = globalThis.scrollY;
    // Content moving up drags the fog with it a little.
    this.push += (scroll - this.last) * 0.9;
    this.last = scroll;
  }

  consume() {
    this.push = 0;
  }
}
