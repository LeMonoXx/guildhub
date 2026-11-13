import type { CinematicTrack } from "@guildhub/contracts";
import {
  defaultEasings,
  interpolateScalar,
  type EasingRegistry,
} from "./easing.js";

export interface TimelineKeyframe<T = unknown> {
  readonly timeMs: number;
  readonly easing?: string;
  readonly value: T;
}

export interface TimelineTrack<T = unknown> {
  readonly kind: string;
  readonly id: string;
  readonly target: string;
  readonly keyframes: readonly TimelineKeyframe<T>[];
  readonly [property: string]: unknown;
}

export interface FrameCommand<T = unknown> {
  readonly kind: string;
  readonly trackId: string;
  readonly target: string;
  readonly value: T;
}

export interface AudioCue {
  readonly trackId: string;
  readonly target: string;
  readonly timeMs: number;
  readonly asset: string;
  readonly cue: string;
  readonly gain: number;
}

export interface EvaluatedTrack {
  readonly command?: FrameCommand;
  readonly audioCues?: readonly AudioCue[];
}

export interface CompiledTrack {
  readonly kind: string;
  readonly id: string;
  evaluate(timeMs: number): EvaluatedTrack;
  reset(): void;
}

export type TrackCompiler<TTrack extends TimelineTrack = TimelineTrack> = (
  track: TTrack,
  easings: EasingRegistry,
) => CompiledTrack;

export class TrackEvaluatorRegistry {
  private readonly compilers = new Map<string, TrackCompiler>();

  register<TTrack extends TimelineTrack>(
    kind: TTrack["kind"],
    compiler: TrackCompiler<TTrack>,
  ): this {
    if (this.compilers.has(kind))
      throw new Error(`Track evaluator "${kind}" is already registered`);
    this.compilers.set(kind, compiler as TrackCompiler);
    return this;
  }

  compile(track: TimelineTrack, easings = defaultEasings): CompiledTrack {
    const compiler = this.compilers.get(track.kind);
    if (!compiler)
      throw new Error(`No evaluator registered for track kind "${track.kind}"`);
    return compiler(track, easings);
  }
}

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value))
      if (child !== null && typeof child === "object") deepFreeze(child);
  }
  return value;
};

interface KeyframeSpan {
  readonly before: TimelineKeyframe;
  readonly after: TimelineKeyframe;
  readonly progress: number;
}

const spanAt = (
  keyframes: readonly TimelineKeyframe[],
  timeMs: number,
  easings: EasingRegistry,
): KeyframeSpan => {
  const first = keyframes[0];
  if (!first) throw new Error("A compiled track requires keyframes");
  if (timeMs <= first.timeMs)
    return { before: first, after: first, progress: 0 };

  for (let index = 1; index < keyframes.length; index += 1) {
    const after = keyframes[index];
    const before = keyframes[index - 1];
    if (!after || !before || timeMs >= after.timeMs) continue;
    const duration = after.timeMs - before.timeMs;
    const linear = duration <= 0 ? 1 : (timeMs - before.timeMs) / duration;
    return {
      before,
      after,
      progress: easings.resolve(after.easing ?? "linear")(linear),
    };
  }
  const last = keyframes.at(-1) ?? first;
  return { before: last, after: last, progress: 1 };
};

const interpolateValue = (
  from: unknown,
  to: unknown,
  progress: number,
): unknown => {
  if (typeof from === "number" && typeof to === "number")
    return interpolateScalar(from, to, progress);
  if (
    from !== null &&
    to !== null &&
    typeof from === "object" &&
    typeof to === "object" &&
    !Array.isArray(from) &&
    !Array.isArray(to)
  ) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(from))
      result[key] = interpolateValue(
        (from as Record<string, unknown>)[key],
        (to as Record<string, unknown>)[key],
        progress,
      );
    return result;
  }
  return progress < 1 ? from : to;
};

const command = (track: TimelineTrack, value: unknown): FrameCommand =>
  deepFreeze({
    kind: track.kind,
    trackId: track.id,
    target: track.target,
    value,
  });

const compileInterpolated: TrackCompiler = (track, easings) => ({
  kind: track.kind,
  id: track.id,
  evaluate(timeMs) {
    const span = spanAt(track.keyframes, timeMs, easings);
    return {
      command: command(
        track,
        interpolateValue(span.before.value, span.after.value, span.progress),
      ),
    };
  },
  reset() {},
});

const compileStep: TrackCompiler = (track, easings) => ({
  kind: track.kind,
  id: track.id,
  evaluate(timeMs) {
    const span = spanAt(track.keyframes, timeMs, easings);
    return { command: command(track, span.before.value) };
  },
  reset() {},
});

const compileClip: TrackCompiler = (track, easings) => ({
  kind: track.kind,
  id: track.id,
  evaluate(timeMs) {
    const span = spanAt(track.keyframes, timeMs, easings);
    const value = span.before.value as {
      readonly playback?: { readonly rate?: number };
      readonly [property: string]: unknown;
    };
    return {
      command: command(track, {
        ...value,
        localTimeMs:
          Math.max(0, timeMs - span.before.timeMs) *
          (value.playback?.rate ?? 1),
      }),
    };
  },
  reset() {},
});

const compileAudio: TrackCompiler = (track) => ({
  kind: track.kind,
  id: track.id,
  evaluate(timeMs) {
    const audioCues = track.keyframes
      .filter((keyframe) => keyframe.timeMs <= timeMs)
      .map((keyframe) => {
        const value = keyframe.value as {
          readonly asset: string;
          readonly cue: string;
          readonly gain: number;
        };
        return deepFreeze({
          trackId: track.id,
          target: track.target,
          timeMs: keyframe.timeMs,
          asset: value.asset,
          cue: value.cue,
          gain: value.gain,
        });
      });
    return { audioCues: Object.freeze(audioCues) };
  },
  reset() {},
});

export const defaultTrackEvaluators = new TrackEvaluatorRegistry()
  .register("clip", compileClip)
  .register("transform", compileInterpolated)
  .register("camera", compileInterpolated)
  .register("light", compileInterpolated)
  .register("visibility", compileStep)
  .register("ui", compileInterpolated)
  .register("emitter", compileInterpolated)
  .register("smoke", compileInterpolated)
  .register("audio", compileAudio);

export const asTimelineTrack = (track: CinematicTrack): TimelineTrack => track;

export const immutable = deepFreeze;
