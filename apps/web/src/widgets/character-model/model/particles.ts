// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Particle semantics follow wowdev.wiki and WebWowViewerCpp.

import type { ParticleCurve, ParticleEmitterMeta } from "./types";
import {
  defaultEmitterStrategies,
  type EmitterSpawnStrategy,
  type EmitterStrategyRegistry,
} from "./emitter-strategies";
import { interpolateValues, sampleTrack } from "./track-sampler";

export { sampleTrack } from "./track-sampler";

export const MAX_PARTICLES = 64;
const STEP = 1 / 30;
const REPLAY = 10;

export interface Particle {
  pos: number[];
  vel: number[];
  age: number;
  life: number;
  sizeFactor: number;
}

export interface EmitterState {
  emitter: ParticleEmitterMeta;
  particles: Particle[];
  owed: number;
  timeMs: number;
  random: () => number;
  spawnStrategy: EmitterSpawnStrategy;
}

export function rng(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

const asArray = (value: number | number[]) =>
  typeof value === "number" ? [value] : value;

export function sampleCurve(
  curve: ParticleCurve | null | undefined,
  fraction: number,
  fallback: number[],
): number[] {
  if (!curve?.times.length) return fallback;
  const firstTime = curve.times[0] ?? 0;
  const firstValue = curve.values[0];
  if (firstValue === undefined) return fallback;
  if (fraction <= firstTime) return asArray(firstValue);
  for (let index = 1; index < curve.times.length; index += 1) {
    const time = curve.times[index];
    if (time === undefined || fraction > time) continue;
    const previousTime = curve.times[index - 1] ?? time;
    return interpolateValues(
      asArray(curve.values[index - 1] ?? firstValue),
      asArray(curve.values[index] ?? firstValue),
      time === previousTime
        ? 1
        : (fraction - previousTime) / (time - previousTime),
    );
  }
  const last = curve.values.at(-1);
  return last === undefined ? fallback : asArray(last);
}

const one = (
  emitter: ParticleEmitterMeta,
  name: keyof ParticleEmitterMeta["tracks"],
  timeMs: number,
  fallback = 0,
) => sampleTrack(emitter.tracks[name], timeMs, [fallback])[0] ?? fallback;
const signed = (random: () => number) => random() * 2 - 1;
const toGltf = (value: number[]) => [
  value[0] ?? 0,
  value[2] ?? 0,
  -(value[1] ?? 0),
];

export function spawn(
  emitter: ParticleEmitterMeta,
  timeMs: number,
  random: () => number,
  registry: EmitterStrategyRegistry = defaultEmitterStrategies,
  report?: (message: string) => void,
): Particle {
  const strategy = registry.resolve(emitter.emitterType, report);
  return spawnWithStrategy(emitter, timeMs, random, strategy);
}

function spawnWithStrategy(
  emitter: ParticleEmitterMeta,
  timeMs: number,
  random: () => number,
  strategy: EmitterSpawnStrategy,
): Particle {
  const zSource = one(emitter, "zSource", timeMs);
  const { position, direction: initialDirection } = strategy({
    emitter,
    timeMs,
    random,
    track: (name, fallback = 0) => one(emitter, name, timeMs, fallback),
    signed: () => signed(random),
  });
  let direction = initialDirection;
  if (zSource > 0) {
    const away = [
      position[0] ?? 0,
      position[1] ?? 0,
      (position[2] ?? 0) - zSource,
    ];
    const length = Math.hypot(...away);
    if (length > 0) direction = away.map((value) => value / length);
  }
  const speed =
    one(emitter, "emissionSpeed", timeMs) *
    (1 + one(emitter, "speedVariation", timeMs) * signed(random));
  const life = Math.max(
    one(emitter, "lifespan", timeMs, 1) +
      emitter.lifespanVariation * signed(random),
    0.01,
  );
  return {
    pos: toGltf(position),
    vel: toGltf(direction.map((value) => value * speed)),
    age: 0,
    life,
    sizeFactor: Math.max(
      1 + (emitter.scaleVariation[0] ?? 0) * signed(random),
      0,
    ),
  };
}

export function createState(
  emitter: ParticleEmitterMeta,
  seed: number,
  registry: EmitterStrategyRegistry = defaultEmitterStrategies,
  report?: (message: string) => void,
): EmitterState {
  return {
    emitter,
    particles: [],
    owed: 0,
    timeMs: 0,
    random: rng(seed),
    spawnStrategy: registry.resolve(emitter.emitterType, report),
  };
}

export function advance(state: EmitterState, delta: number): void {
  const emitter = state.emitter;
  const gravity = sampleTrack(emitter.tracks.gravity, state.timeMs, [0, 0, 0]);
  const drag = emitter.drag > 0 ? Math.exp(-emitter.drag * delta) : 1;
  for (const particle of state.particles) {
    particle.age += delta;
    for (let index = 0; index < 3; index += 1) {
      particle.vel[index] =
        ((particle.vel[index] ?? 0) + (gravity[index] ?? 0) * delta) * drag;
      particle.pos[index] =
        (particle.pos[index] ?? 0) + (particle.vel[index] ?? 0) * delta;
    }
  }
  state.particles = state.particles.filter(
    (particle) => particle.age < particle.life,
  );
  state.timeMs += delta * 1000;
  const rate = Math.max(
    one(emitter, "emissionRate", state.timeMs) +
      emitter.emissionRateVariation * signed(state.random),
    0,
  );
  state.owed += rate * delta;
  while (state.owed >= 1 - 1e-9) {
    state.owed -= 1;
    if (state.particles.length < MAX_PARTICLES)
      state.particles.push(
        spawnWithStrategy(
          emitter,
          state.timeMs,
          state.random,
          state.spawnStrategy,
        ),
      );
  }
}

export function simulateTo(
  emitter: ParticleEmitterMeta,
  seed: number,
  time: number,
  registry: EmitterStrategyRegistry = defaultEmitterStrategies,
  report?: (message: string) => void,
): EmitterState {
  const state = createState(emitter, seed, registry, report);
  const start = Math.max(time - REPLAY, 0);
  state.timeMs = start * 1000;
  for (let left = Math.max(time, 0) - start; left > 1e-9; left -= STEP)
    advance(state, Math.min(STEP, left));
  return state;
}

export function appearance(emitter: ParticleEmitterMeta, particle: Particle) {
  const fraction = Math.min(particle.age / particle.life, 1);
  return {
    color: sampleCurve(emitter.color, fraction, [1, 1, 1]),
    alpha: sampleCurve(emitter.alpha, fraction, [1])[0] ?? 1,
    size:
      (sampleCurve(emitter.scale, fraction, [1, 1])[0] ?? 1) *
      particle.sizeFactor,
    cell: Math.round(sampleCurve(emitter.headCell, fraction, [0])[0] ?? 0),
  };
}
