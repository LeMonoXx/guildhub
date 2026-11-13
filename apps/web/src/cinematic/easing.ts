export type Easing = (progress: number) => number;

const clamp01 = (value: number): number => Math.min(Math.max(value, 0), 1);

export class EasingRegistry {
  private readonly easings = new Map<string, Easing>();

  register(name: string, easing: Easing): this {
    if (this.easings.has(name))
      throw new Error(`Easing "${name}" is already registered`);
    this.easings.set(name, easing);
    return this;
  }

  resolve(name: string): Easing {
    const easing = this.easings.get(name);
    if (!easing) throw new Error(`Unknown easing "${name}"`);
    return (progress) => clamp01(easing(clamp01(progress)));
  }
}

export const defaultEasings = new EasingRegistry()
  .register("linear", (value) => value)
  .register("step", (value) => (value < 1 ? 0 : 1))
  .register("ease-in", (value) => value * value)
  .register("ease-out", (value) => 1 - (1 - value) ** 2)
  .register("ease-in-out", (value) =>
    value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2,
  )
  .register("easeIn", (value) => value * value)
  .register("easeOut", (value) => 1 - (1 - value) ** 2)
  .register("easeInOut", (value) =>
    value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2,
  );

export const interpolateScalar = (
  from: number,
  to: number,
  progress: number,
): number => from + (to - from) * progress;

export const interpolateVector = (
  from: readonly number[],
  to: readonly number[],
  progress: number,
): readonly number[] =>
  Object.freeze(
    from.map((value, index) =>
      interpolateScalar(value, to[index] ?? value, progress),
    ),
  );
