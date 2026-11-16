export interface SceneMarker {
  readonly id: string;
  readonly timeMs: number;
}

export interface AuthoredScenePhase {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface ScenePhase {
  readonly id: string;
  readonly index: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly progress: number;
}

/**
 * Explicit phases are authoritative when present. Both explicit and
 * marker-derived phases use left-closed/right-open intervals. The exact
 * terminal frame is the sole exception: a phase ending at duration owns that
 * frame with progress 1.
 */
export class SceneStateMachine {
  private readonly markers: readonly SceneMarker[];
  private readonly authoredPhases: readonly AuthoredScenePhase[];

  constructor(
    markers: readonly SceneMarker[],
    private readonly durationMs: number,
    phases: readonly AuthoredScenePhase[] = [],
  ) {
    this.markers = Object.freeze(
      [...markers].sort(
        (left, right) =>
          left.timeMs - right.timeMs || left.id.localeCompare(right.id),
      ),
    );
    this.authoredPhases = Object.freeze([...phases]);
  }

  phaseAt(timeMs: number): ScenePhase {
    return this.authoredPhases.length > 0
      ? this.authoredPhaseAt(timeMs)
      : this.markerPhaseAt(timeMs);
  }

  private authoredPhaseAt(timeMs: number): ScenePhase {
    const index = this.authoredPhases.findIndex(
      (phase) =>
        (phase.startMs <= timeMs && timeMs < phase.endMs) ||
        (timeMs === this.durationMs &&
          phase.endMs === this.durationMs &&
          phase.startMs <= timeMs),
    );
    const phase = this.authoredPhases[index];
    if (phase)
      return this.result(phase.id, index, phase.startMs, phase.endMs, timeMs);

    const nextIndex = this.authoredPhases.findIndex(
      (candidate) => candidate.startMs > timeMs,
    );
    const previous =
      nextIndex < 0
        ? this.authoredPhases.at(-1)
        : this.authoredPhases[nextIndex - 1];
    const next = nextIndex < 0 ? undefined : this.authoredPhases[nextIndex];
    const startMs = previous?.endMs ?? 0;
    const endMs = next?.startMs ?? this.durationMs;
    return this.result(
      previous ? "gap" : "initial",
      -1,
      startMs,
      endMs,
      timeMs,
    );
  }

  private markerPhaseAt(timeMs: number): ScenePhase {
    let index = -1;
    for (let cursor = 0; cursor < this.markers.length; cursor += 1) {
      const marker = this.markers[cursor];
      if (!marker || marker.timeMs > timeMs) break;
      index = cursor;
    }

    const marker = this.markers[index];
    const next = this.markers[index + 1];
    const startMs = marker?.timeMs ?? 0;
    const endMs = next?.timeMs ?? this.durationMs;
    return this.result(marker?.id ?? "initial", index, startMs, endMs, timeMs);
  }

  private result(
    id: string,
    index: number,
    startMs: number,
    endMs: number,
    timeMs: number,
  ): ScenePhase {
    const span = endMs - startMs;
    return Object.freeze({
      id,
      index,
      startMs,
      endMs,
      progress:
        span <= 0 ? 1 : Math.min(Math.max((timeMs - startMs) / span, 0), 1),
    });
  }
}
