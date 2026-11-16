export type TrackInterpolation =
  "none" | "linear" | "bezier" | "hermite" | number;

export interface SampledTrack {
  durationMs: number;
  interpolation: TrackInterpolation;
  keys: number[][];
}

export interface TrackSampleOptions {
  report?: (message: string) => void;
}

const lerp = (a: number[], b: number[], factor: number): number[] =>
  a.map((value, index) => value + ((b[index] ?? value) - value) * factor);

const interpolationNames: readonly string[] = ["none", "linear"];

const interpolationName = (interpolation: TrackInterpolation): string =>
  typeof interpolation === "number"
    ? (interpolationNames[interpolation] ?? `mode ${String(interpolation)}`)
    : interpolation;

const isStep = (interpolation: TrackInterpolation): boolean =>
  interpolation === "none" || interpolation === 0;

const isSpline = (interpolation: TrackInterpolation): boolean =>
  interpolation === "bezier" ||
  interpolation === "hermite" ||
  (typeof interpolation === "number" && interpolation > 1);

export function sampleTrack(
  track: SampledTrack | undefined,
  timeMs: number,
  fallback: number[],
  options: TrackSampleOptions = {},
): number[] {
  if (!track?.keys.length) return fallback;
  const time =
    track.durationMs > 0
      ? ((timeMs % track.durationMs) + track.durationMs) % track.durationMs
      : timeMs;
  const first = track.keys[0];
  if (!first || time <= (first[0] ?? 0)) return first?.slice(1) ?? fallback;
  for (let index = 1; index < track.keys.length; index += 1) {
    const before = track.keys[index - 1];
    const after = track.keys[index];
    if (!before || !after || time >= (after[0] ?? 0)) continue;
    if (isStep(track.interpolation)) return before.slice(1);
    if (isSpline(track.interpolation))
      options.report?.(
        `Unsupported ${interpolationName(track.interpolation)} interpolation; using linear fallback`,
      );
    const start = before[0] ?? 0;
    const end = after[0] ?? start;
    return lerp(
      before.slice(1),
      after.slice(1),
      end === start ? 1 : (time - start) / (end - start),
    );
  }
  return track.keys.at(-1)?.slice(1) ?? fallback;
}

export function interpolateValues(
  before: number[],
  after: number[],
  factor: number,
): number[] {
  return lerp(before, after, factor);
}
