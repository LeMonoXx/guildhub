import type { ParticleEmitterMeta } from "./types";

export interface EmitterSpawn {
  position: number[];
  direction: number[];
}

export interface EmitterSpawnContext {
  emitter: ParticleEmitterMeta;
  timeMs: number;
  random: () => number;
  track(name: keyof ParticleEmitterMeta["tracks"], fallback?: number): number;
  signed(): number;
}

export type EmitterSpawnStrategy = (
  context: EmitterSpawnContext,
) => EmitterSpawn;

const point: EmitterSpawnStrategy = () => ({
  position: [0, 0, 0],
  direction: [0, 0, 1],
});

const plane: EmitterSpawnStrategy = (context) => {
  const position = [
    (context.signed() * context.track("areaX")) / 2,
    (context.signed() * context.track("areaY")) / 2,
    0,
  ];
  const polar = context.signed() * context.track("verticalRange");
  const azimuth = context.signed() * context.track("horizontalRange");
  return {
    position,
    direction: [
      Math.sin(polar) * Math.cos(azimuth),
      Math.sin(polar) * Math.sin(azimuth),
      Math.cos(polar),
    ],
  };
};

const sphere: EmitterSpawnStrategy = (context) => {
  const areaX = context.track("areaX");
  const areaY = context.track("areaY");
  const radius =
    Math.min(areaX, areaY) + context.random() * Math.abs(areaY - areaX);
  const elevation = context.signed() * context.track("verticalRange");
  const azimuth = context.signed() * context.track("horizontalRange");
  const position = [
    radius * Math.cos(elevation) * Math.cos(azimuth),
    radius * Math.cos(elevation) * Math.sin(azimuth),
    radius * Math.sin(elevation),
  ];
  const length = Math.hypot(...position);
  return {
    position,
    direction: length > 0 ? position.map((value) => value / length) : [0, 0, 1],
  };
};

export class EmitterStrategyRegistry {
  private readonly strategies = new Map<number, EmitterSpawnStrategy>();

  register(type: number, strategy: EmitterSpawnStrategy): this {
    this.strategies.set(type, strategy);
    return this;
  }

  resolve(
    type: number,
    report: (message: string) => void = console.warn,
  ): EmitterSpawnStrategy {
    const strategy = this.strategies.get(type);
    if (strategy) return strategy;
    report(
      `Unsupported particle emitter type ${String(type)}; using point fallback`,
    );
    return point;
  }
}

export const defaultEmitterStrategies = new EmitterStrategyRegistry()
  .register(1, plane)
  .register(2, sphere);
