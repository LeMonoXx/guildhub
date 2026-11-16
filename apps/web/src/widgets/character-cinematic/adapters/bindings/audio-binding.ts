import type { AudioCue, FrameCommand } from "../../../../shared/cinematic";
import type { BindingContext, CommandBinding } from "./registry";

export class AudioBindingState implements CommandBinding<AudioBindingState> {
  private readonly consumed = new Set<string>();

  apply(
    target: AudioBindingState,
    command: FrameCommand,
    context: BindingContext,
  ): void {
    const cue = command.value as AudioCue;
    target.consumed.add(
      `${String(context.frame.iteration)}:${cue.trackId}:${String(cue.timeMs)}`,
    );
  }

  get cueIds(): readonly string[] {
    return [...this.consumed];
  }

  reset(): void {
    this.consumed.clear();
  }
}
