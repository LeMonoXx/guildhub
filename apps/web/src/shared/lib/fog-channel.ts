/*
 * A neutral meeting point between whatever moves on the page and the page fog.
 * Bodies (the character stage) report where they stand; the fog reads them and
 * flows around them. Neither side imports the other.
 */

/** A body the fog flows around, in viewport CSS pixels. */
export interface FogFigure {
  readonly id: string;
  /** Horizontal centre. */
  readonly x: number;
  /** Where the feet touch the ground. */
  readonly feet: number;
  /** Top of the head. */
  readonly head: number;
  readonly halfWidth: number;
}

/** Reports older than this are treated as gone (the stage paused or left). */
const freshMs = 400;

let figures: readonly FogFigure[] = [];
let reportedAt = Number.NEGATIVE_INFINITY;

export const reportFogFigures = (next: readonly FogFigure[]): void => {
  figures = next;
  reportedAt = performance.now();
};

export const clearFogFigures = (): void => {
  figures = [];
  reportedAt = Number.NEGATIVE_INFINITY;
};

export const readFogFigures = (
  now: number = performance.now(),
): readonly FogFigure[] => (now - reportedAt < freshMs ? figures : []);
