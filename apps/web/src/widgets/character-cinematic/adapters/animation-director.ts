import type { CinematicFrame, FrameCommand } from "../../../shared/cinematic";
import type {
  BindingDiagnostic,
  BindingRegistry,
  BindingTargetRegistry,
} from "./bindings";

/** Routes every frame command to the binding registered for its kind. */
export class AnimationDirector {
  constructor(
    readonly bindings: BindingRegistry,
    readonly targets: BindingTargetRegistry,
    private readonly report: BindingDiagnostic = () => undefined,
  ) {}

  apply(frame: CinematicFrame): void {
    for (const command of frame.commands) this.dispatch(command, frame);
    for (const cue of frame.audioCues)
      this.dispatch(
        {
          kind: "audio",
          trackId: cue.trackId,
          target: cue.target,
          value: cue,
        },
        frame,
      );
  }

  reset(): void {
    this.bindings.reset();
  }

  private dispatch(command: FrameCommand, frame: CinematicFrame): void {
    const binding = this.bindings.resolve(command.kind);
    if (!binding) {
      this.report(`Unknown binding kind "${command.kind}"`);
      return;
    }
    const target = this.targets.resolve(command.kind, command.target);
    if (target === undefined) {
      this.report(
        `Unknown ${command.kind} target "${command.target}" for track "${command.trackId}"`,
      );
      return;
    }
    binding.apply(target, command, { frame, report: this.report });
  }
}
