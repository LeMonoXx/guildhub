import type {
  CinematicFrame,
  CinematicTimeline,
} from "../../../shared/cinematic";

export interface PlaybackStage {
  show(frame: CinematicFrame): void;
  render(): void;
  fitCameraTo(height: number): void;
}

export interface PlaybackOptions {
  readonly reducedMotion: boolean;
  readonly posterTimeMs?: number | undefined;
  readonly previewTimeMs?: number | undefined;
  /** Scale the camera to the loaded actor's real crown height. */
  readonly fitToActorHeight?: number | undefined;
}

/** A still frame when motion is reduced or a preview time is pinned; the running clock otherwise. */
export const evaluateMotionFrame = (
  timeline: CinematicTimeline,
  reducedMotion: boolean,
  posterTimeMs?: number,
  previewTimeMs?: number,
): CinematicFrame =>
  reducedMotion || previewTimeMs !== undefined
    ? timeline.poster(previewTimeMs ?? posterTimeMs)
    : timeline.evaluate(timeline.clock.time.elapsedMs);

/** Shows the first frame and, unless the scene stands still, keeps it playing; returns the stop. */
export function startPlayback(
  timeline: CinematicTimeline,
  stage: PlaybackStage,
  options: PlaybackOptions,
): () => void {
  if (options.fitToActorHeight !== undefined) {
    stage.show(timeline.poster(options.posterTimeMs));
    stage.fitCameraTo(options.fitToActorHeight);
  }
  if (options.reducedMotion || options.previewTimeMs !== undefined) {
    stage.show(
      evaluateMotionFrame(
        timeline,
        options.reducedMotion,
        options.posterTimeMs,
        options.previewTimeMs,
      ),
    );
    stage.render();
    return () => undefined;
  }
  stage.show(timeline.play());
  stage.render();
  let frameRequest = 0;
  let previousTimestamp: number | undefined;
  const animate = (timestamp: number) => {
    const delta =
      previousTimestamp === undefined ? 0 : timestamp - previousTimestamp;
    previousTimestamp = timestamp;
    stage.show(timeline.tick(Math.max(0, delta)));
    stage.render();
    frameRequest = requestAnimationFrame(animate);
  };
  frameRequest = requestAnimationFrame(animate);
  return () => {
    cancelAnimationFrame(frameRequest);
  };
}

/** Coalesces progress reports to one state update per animation frame. */
export function frameThrottled(apply: (fraction: number) => void): {
  readonly report: (fraction: number) => void;
  readonly cancel: () => void;
} {
  let request = 0;
  let pending = 0;
  return {
    report: (fraction) => {
      pending = fraction;
      if (request !== 0) return;
      request = requestAnimationFrame(() => {
        request = 0;
        apply(pending);
      });
    },
    cancel: () => {
      cancelAnimationFrame(request);
    },
  };
}
