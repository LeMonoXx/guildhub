import type {
  CinematicFrame,
  FrameCommand,
} from "../../../../shared/cinematic";

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
