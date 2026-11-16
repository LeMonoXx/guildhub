import type { FrameCommand } from "../../../../shared/cinematic";
import type { CharacterHandle } from "../../../character-model";
import type { BindingContext, CommandBinding } from "./registry";

interface ClipValue {
  readonly animationGroup: string | number;
  readonly crossfadeMs: number;
  readonly localTimeMs: number;
  readonly overlay?: {
    readonly id: string;
    readonly animationGroup: string | number;
    readonly mask: "upper-body";
    readonly weight: number;
    readonly fadeMs: number;
  };
}

interface PlayedOverlay {
  readonly id: string;
  readonly selection: string;
  readonly fadeMs: number;
}

interface Playback {
  readonly animationGroup: string | number;
  readonly iteration: number;
  readonly elapsedMs: number;
  readonly localTimeMs: number;
  readonly overlay: PlayedOverlay | undefined;
}

const seconds = (ms: number) => Math.max(0, ms) / 1000;

/** Swaps the upper-body layer when its clip changed and keeps it in time. */
function applyOverlay(
  target: CharacterHandle,
  value: ClipValue,
  prior: PlayedOverlay | undefined,
  selection: string | undefined,
  continuous: boolean,
): void {
  const changed =
    prior?.id !== value.overlay?.id || prior?.selection !== selection;
  if (prior && changed)
    target.clearAnimationLayer(prior.id, seconds(prior.fadeMs));
  const overlay = value.overlay;
  if (!overlay) return;
  if (changed)
    target.selectAnimationLayer(
      overlay.id,
      overlay.animationGroup,
      overlay.mask,
      seconds(overlay.fadeMs),
      overlay.weight,
    );
  if (changed || !continuous)
    target.setAnimationLayerTime(overlay.id, seconds(value.localTimeMs));
}

/** Plays forward from the last frame of the same loop; anything else is a seek. */
function advanceBaseClip(
  target: CharacterHandle,
  value: ClipValue,
  elapsedMs: number,
  continuedFrom: Playback | undefined,
  groupChanged: boolean,
): void {
  if (continuedFrom === undefined) {
    target.setTime(seconds(value.localTimeMs));
    return;
  }
  target.update(
    seconds(
      groupChanged ? value.localTimeMs : elapsedMs - continuedFrom.elapsedMs,
    ),
  );
}

export class ClipBinding implements CommandBinding<CharacterHandle> {
  private readonly playback = new WeakMap<CharacterHandle, Playback>();

  apply(
    target: CharacterHandle,
    command: FrameCommand,
    context: BindingContext,
  ): void {
    const value = command.value as ClipValue;
    const previous = this.playback.get(target);
    const groupChanged = previous?.animationGroup !== value.animationGroup;
    const overlaySelection = value.overlay
      ? `${String(value.overlay.animationGroup)}:${value.overlay.mask}`
      : undefined;
    const continuous =
      previous !== undefined &&
      previous.iteration === context.frame.iteration &&
      context.frame.elapsedMs >= previous.elapsedMs;

    if (groupChanged)
      target.selectAnimationGroup(
        value.animationGroup,
        seconds(value.crossfadeMs),
      );
    advanceBaseClip(
      target,
      value,
      context.frame.elapsedMs,
      continuous ? previous : undefined,
      groupChanged,
    );
    applyOverlay(
      target,
      value,
      previous?.overlay,
      overlaySelection,
      continuous,
    );
    this.playback.set(target, {
      animationGroup: value.animationGroup,
      iteration: context.frame.iteration,
      elapsedMs: context.frame.elapsedMs,
      localTimeMs: value.localTimeMs,
      overlay: value.overlay
        ? {
            id: value.overlay.id,
            selection: overlaySelection ?? "",
            fadeMs: value.overlay.fadeMs,
          }
        : undefined,
    });
  }

  reset(): void {
    // WeakMap entries vanish with their handles. Loop iteration changes force
    // one deterministic seek before incremental playback resumes.
  }
}
