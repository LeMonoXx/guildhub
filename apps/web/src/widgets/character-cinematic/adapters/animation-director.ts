import * as THREE from "three";
import type {
  AudioCue,
  CinematicFrame,
  FrameCommand,
} from "../../../cinematic";
import type { CharacterHandle } from "../../character-model";
import type { SmokeEffect, SmokeValues } from "./smoke-effect";

export type BindingDiagnostic = (message: string) => void;

export interface BindingContext {
  readonly frame: CinematicFrame;
  readonly report: BindingDiagnostic;
}

export interface CommandBinding<TTarget = unknown> {
  apply(target: TTarget, command: FrameCommand, context: BindingContext): void;
  reset?(): void;
}

export class BindingRegistry {
  private readonly bindings = new Map<string, CommandBinding>();

  register(kind: string, binding: CommandBinding): this {
    if (this.bindings.has(kind))
      throw new Error(`Binding "${kind}" is already registered`);
    this.bindings.set(kind, binding);
    return this;
  }

  resolve(kind: string): CommandBinding | undefined {
    return this.bindings.get(kind);
  }

  reset(): void {
    for (const binding of this.bindings.values()) binding.reset?.();
  }
}

export class BindingTargetRegistry {
  private readonly targets = new Map<string, unknown>();

  register(kind: string, id: string, target: unknown): this {
    this.targets.set(`${kind}:${id}`, target);
    return this;
  }

  resolve(kind: string, id: string): unknown {
    return this.targets.get(`${kind}:${id}`);
  }
}

export interface UiBindingState {
  readonly opacity: number;
  readonly translation: Readonly<{ x: number; y: number; z: number }>;
  readonly scale: number;
  readonly blur: number;
}

export interface UiBindingTarget {
  setState(state: UiBindingState): void;
}

export interface CameraBindingTarget {
  setCamera(
    position: Readonly<{ x: number; y: number; z: number }>,
    target: Readonly<{ x: number; y: number; z: number }>,
    fov: number,
  ): void;
}

export interface EmitterBindingTarget {
  apply(value: unknown, timeMs: number): void;
}

interface ClipValue {
  readonly animationGroup: string | number;
  readonly crossfadeMs: number;
  readonly localTimeMs: number;
}

export class ClipBinding implements CommandBinding<CharacterHandle> {
  private readonly selected = new WeakMap<CharacterHandle, string | number>();

  apply(target: CharacterHandle, command: FrameCommand): void {
    const value = command.value as ClipValue;
    if (this.selected.get(target) !== value.animationGroup) {
      target.selectAnimationGroup(
        value.animationGroup,
        Math.max(0, value.crossfadeMs) / 1000,
      );
      this.selected.set(target, value.animationGroup);
    }
    target.setTime(Math.max(0, value.localTimeMs) / 1000);
  }

  reset(): void {
    // WeakMap entries vanish with their handles. Selection is deliberately
    // retained across timeline loops when the first group is unchanged.
  }
}

const transformBinding: CommandBinding<THREE.Object3D> = {
  apply(target, command) {
    const value = command.value as {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    };
    target.position.set(value.position.x, value.position.y, value.position.z);
    target.rotation.set(value.rotation.x, value.rotation.y, value.rotation.z);
    target.scale.set(value.scale.x, value.scale.y, value.scale.z);
  },
};

const cameraBinding: CommandBinding<CameraBindingTarget> = {
  apply(target, command) {
    const value = command.value as {
      position: { x: number; y: number; z: number };
      target: { x: number; y: number; z: number };
      fov: number;
    };
    target.setCamera(value.position, value.target, value.fov);
  },
};

const lightBinding: CommandBinding<THREE.Light> = {
  apply(target, command) {
    const value = command.value as {
      position: { x: number; y: number; z: number };
      color: string;
      intensity: number;
    };
    target.position.set(value.position.x, value.position.y, value.position.z);
    target.color.set(value.color);
    target.intensity = value.intensity;
  },
};

const visibilityBinding: CommandBinding<THREE.Object3D> = {
  apply(target, command) {
    target.visible = Boolean(command.value);
  },
};

const uiBinding: CommandBinding<UiBindingTarget> = {
  apply(target, command) {
    target.setState(command.value as UiBindingState);
  },
};

const emitterBinding: CommandBinding<EmitterBindingTarget> = {
  apply(target, command, context) {
    target.apply(command.value, context.frame.timeMs);
  },
};

const smokeBinding: CommandBinding<SmokeEffect> = {
  apply(target, command, context) {
    target.apply(command.value as SmokeValues, context.frame.timeMs);
  },
};

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

export const createDefaultBindings = (): BindingRegistry =>
  new BindingRegistry()
    .register("clip", new ClipBinding())
    .register("transform", transformBinding)
    .register("camera", cameraBinding)
    .register("light", lightBinding)
    .register("visibility", visibilityBinding)
    .register("ui", uiBinding)
    .register("emitter", emitterBinding)
    .register("smoke", smokeBinding)
    .register("audio", new AudioBindingState());

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
