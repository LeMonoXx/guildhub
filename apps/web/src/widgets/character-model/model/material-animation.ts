import type { TimelineParticipant } from "./lifecycle";
import {
  applyFrame,
  captureBase,
  restoreBase,
  type MaterialBaseState,
} from "./material-base-state";
import {
  defaultMaterialBindings,
  initialMaterialFrame,
  type FrameWriter,
  type MaterialAnimationBinding,
  type MaterialBindingRegistry,
} from "./material-bindings";
import { sampleTrack } from "./track-sampler";
import type { MaterialAnimation } from "./types";
interface CompiledChannel {
  readonly bindingIndex: number;
  readonly tracks: MaterialAnimation[];
  readonly write: FrameWriter;
}

const channelKey = (bindingIndex: number, track: MaterialAnimation): string =>
  `${String(bindingIndex)}:${track.kind}:${String(track.targetIndex)}`;

const variation = (track: MaterialAnimation): number => track.variation ?? 0;

/** A global-sequence track always plays; otherwise the active sequence's first variation. */
const selectedTrack = (
  tracks: readonly MaterialAnimation[],
  sequenceId: number,
): MaterialAnimation | undefined =>
  tracks.find(
    (track) =>
      track.globalSequence !== null && track.globalSequence !== undefined,
  ) ??
  tracks
    .filter((track) => (track.sequenceId ?? 0) === sequenceId)
    .sort((left, right) => variation(left) - variation(right))[0];

function compileChannels(
  bindings: readonly MaterialAnimationBinding[],
  tracks: readonly MaterialAnimation[],
  registry: MaterialBindingRegistry,
): CompiledChannel[] {
  const grouped = new Map<string, CompiledChannel>();
  bindings.forEach((binding, bindingIndex) => {
    for (const track of tracks) {
      const write = registry.compile(binding, track);
      if (!write) continue;
      const key = channelKey(bindingIndex, track);
      const channel = grouped.get(key);
      if (channel) channel.tracks.push(track);
      else grouped.set(key, { bindingIndex, tracks: [track], write });
    }
  });
  return [...grouped.values()];
}

export class MaterialAnimationController implements TimelineParticipant {
  private readonly states: MaterialBaseState[];
  private readonly channels: CompiledChannel[];
  private readonly reported = new Set<string>();
  private time = 0;
  private sequenceId: number;
  private disposed = false;

  constructor(
    bindings: readonly MaterialAnimationBinding[],
    tracks: readonly MaterialAnimation[],
    private readonly timeScale = 1,
    defaultSequenceId = 0,
    registry: MaterialBindingRegistry = defaultMaterialBindings,
    private readonly report?: (message: string) => void,
  ) {
    this.sequenceId = defaultSequenceId;
    this.states = bindings.map(captureBase);
    this.channels = compileChannels(bindings, tracks, registry);
    this.applyTime();
  }

  selectSequence(sequenceId: number): void {
    if (this.disposed) return;
    this.sequenceId = sequenceId;
    this.time = 0;
    this.applyTime();
  }

  update(delta: number): void {
    if (this.disposed) return;
    this.time += Math.max(delta, 0) * Math.max(this.timeScale, 0);
    this.applyTime();
  }

  setTime(time: number): void {
    if (this.disposed) return;
    this.time = Math.max(time, 0) * Math.max(this.timeScale, 0);
    this.applyTime();
  }

  reset(): void {
    if (this.disposed) return;
    this.time = 0;
    this.applyTime();
  }

  dispose(): void {
    if (this.disposed) return;
    for (const state of this.states) restoreBase(state);
    this.disposed = true;
  }

  private reportOnce = (message: string) => {
    if (this.reported.has(message)) return;
    this.reported.add(message);
    this.report?.(message);
  };

  private applyTime(): void {
    const frames = this.states.map(() => initialMaterialFrame());
    for (const channel of this.channels) {
      const track = selectedTrack(channel.tracks, this.sequenceId);
      const frame = frames[channel.bindingIndex];
      if (!track || !frame) continue;
      channel.write(
        frame,
        sampleTrack(track, this.time * 1000, [], { report: this.reportOnce }),
      );
    }
    this.states.forEach((state, index) => {
      applyFrame(state, frames[index] ?? initialMaterialFrame());
    });
  }
}
