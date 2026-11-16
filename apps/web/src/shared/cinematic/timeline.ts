import { cinematicSceneSchema, type CinematicScene } from "@guildhub/contracts";
import { SceneClock, type SceneTime } from "./clock.js";
import {
  asTimelineTrack,
  defaultTrackEvaluators,
  immutable,
  type AudioCue,
  type CompiledTrack,
  type FrameCommand,
  type TimelineTrack,
  type TrackEvaluatorRegistry,
} from "./evaluators.js";
import { SceneStateMachine, type ScenePhase } from "./state-machine.js";

export interface CinematicFrame {
  readonly timeMs: number;
  readonly elapsedMs: number;
  readonly iteration: number;
  readonly atEnd: boolean;
  readonly phase: ScenePhase;
  readonly commands: readonly FrameCommand[];
  /**
   * Cues at or before this frame in the current iteration. They are data only:
   * the core never performs playback. A binding that plays cues must
   * edge-trigger and deduplicate them by iteration + trackId + timeMs.
   */
  readonly audioCues: readonly AudioCue[];
}

export interface CompileTimelineOptions {
  readonly evaluators?: TrackEvaluatorRegistry;
}

const evaluateCompiled = (
  compiled: readonly CompiledTrack[],
  state: SceneTime,
  phases: SceneStateMachine,
): CinematicFrame => {
  const commands: FrameCommand[] = [];
  const audioCues: AudioCue[] = [];
  for (const evaluator of compiled) {
    const result = evaluator.evaluate(state.timeMs);
    if (result.command) commands.push(result.command);
    if (result.audioCues) audioCues.push(...result.audioCues);
  }
  audioCues.sort(
    (left, right) =>
      left.timeMs - right.timeMs ||
      left.trackId.localeCompare(right.trackId) ||
      left.cue.localeCompare(right.cue),
  );
  return immutable({
    timeMs: state.timeMs,
    elapsedMs: state.elapsedMs,
    iteration: state.iteration,
    atEnd: state.atEnd,
    phase: phases.phaseAt(state.timeMs),
    commands,
    audioCues,
  });
};

export class CinematicTimeline {
  readonly scene: CinematicScene;
  readonly clock: SceneClock;
  private readonly compiled: readonly CompiledTrack[];
  private readonly phases: SceneStateMachine;

  constructor(scene: CinematicScene, options: CompileTimelineOptions = {}) {
    this.scene = scene;
    this.clock = new SceneClock({
      durationMs: scene.durationMs,
      loop: scene.loop,
    });
    const registry = options.evaluators ?? defaultTrackEvaluators;
    this.compiled = Object.freeze(
      scene.tracks.map((track) => registry.compile(asTimelineTrack(track))),
    );
    this.phases = new SceneStateMachine(
      scene.markers,
      scene.durationMs,
      scene.phases,
    );
  }

  play(): CinematicFrame {
    return this.evaluateTime(this.clock.play());
  }

  pause(): CinematicFrame {
    return this.evaluateTime(this.clock.pause());
  }

  tick(deltaMs: number): CinematicFrame {
    return this.evaluateTime(this.clock.tick(deltaMs));
  }

  seek(elapsedMs: number): CinematicFrame {
    return this.evaluateTime(this.clock.seek(elapsedMs));
  }

  evaluate(elapsedMs: number): CinematicFrame {
    const probe = new SceneClock({
      durationMs: this.scene.durationMs,
      loop: this.scene.loop,
    });
    return this.evaluateTime(probe.seek(elapsedMs));
  }

  /**
   * Evaluates a still frame without loop wrapping. The default is the exact
   * terminal frame; callers may select any authored poster time.
   */
  poster(timeMs = this.scene.durationMs): CinematicFrame {
    const posterClock = new SceneClock({
      durationMs: this.scene.durationMs,
      loop: false,
    });
    return this.evaluateTime(posterClock.seek(timeMs));
  }

  reset(): CinematicFrame {
    for (const evaluator of this.compiled) evaluator.reset();
    return this.evaluateTime(this.clock.reset());
  }

  private evaluateTime(state: SceneTime): CinematicFrame {
    return evaluateCompiled(this.compiled, state, this.phases);
  }
}

export const compileTimeline = (
  input: unknown,
  options?: CompileTimelineOptions,
): CinematicTimeline =>
  new CinematicTimeline(cinematicSceneSchema.parse(input), options);

export const compileTracks = (
  tracks: readonly TimelineTrack[],
  registry: TrackEvaluatorRegistry,
): readonly CompiledTrack[] =>
  Object.freeze(tracks.map((track) => registry.compile(track)));
