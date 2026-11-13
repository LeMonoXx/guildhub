export interface SceneClockOptions {
  durationMs: number;
  loop: boolean;
}

export interface SceneTime {
  readonly timeMs: number;
  readonly elapsedMs: number;
  readonly iteration: number;
  readonly atEnd: boolean;
}

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

const normalize = (
  elapsedMs: number,
  durationMs: number,
  loop: boolean,
): SceneTime => {
  const elapsed = finite(elapsedMs);
  if (durationMs <= 0)
    return Object.freeze({
      timeMs: 0,
      elapsedMs: elapsed,
      iteration: 0,
      atEnd: true,
    });
  if (!loop) {
    const timeMs = Math.min(Math.max(elapsed, 0), durationMs);
    return Object.freeze({
      timeMs,
      elapsedMs: elapsed,
      iteration: 0,
      atEnd: timeMs === durationMs,
    });
  }

  const iteration = Math.floor(elapsed / durationMs);
  const timeMs = elapsed - iteration * durationMs;
  return Object.freeze({
    timeMs: Object.is(timeMs, -0) ? 0 : timeMs,
    elapsedMs: elapsed,
    iteration,
    atEnd: false,
  });
};

/**
 * An absolute scene clock. Tick deltas update one elapsed-time origin; scene
 * time is always derived from that origin, so wrapping never subtracts
 * duration repeatedly and cannot accumulate loop drift.
 */
export class SceneClock {
  readonly durationMs: number;
  readonly loop: boolean;
  private elapsed = 0;
  private compensation = 0;
  private playing = false;

  constructor(options: SceneClockOptions) {
    if (!Number.isFinite(options.durationMs) || options.durationMs < 0)
      throw new RangeError("durationMs must be finite and non-negative");
    this.durationMs = options.durationMs;
    this.loop = options.loop;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get time(): SceneTime {
    return normalize(this.elapsed, this.durationMs, this.loop);
  }

  play(): SceneTime {
    this.playing = true;
    return this.time;
  }

  pause(): SceneTime {
    this.playing = false;
    return this.time;
  }

  tick(deltaMs: number): SceneTime {
    if (!Number.isFinite(deltaMs))
      throw new RangeError("deltaMs must be finite");
    if (this.playing) {
      const corrected = deltaMs - this.compensation;
      const next = this.elapsed + corrected;
      this.compensation = next - this.elapsed - corrected;
      this.elapsed = next;
    }
    return this.time;
  }

  seek(elapsedMs: number): SceneTime {
    if (!Number.isFinite(elapsedMs))
      throw new RangeError("elapsedMs must be finite");
    this.elapsed = elapsedMs;
    this.compensation = 0;
    return this.time;
  }

  reset(): SceneTime {
    this.elapsed = 0;
    this.compensation = 0;
    this.playing = false;
    return this.time;
  }
}
