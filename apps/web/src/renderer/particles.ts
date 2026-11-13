// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Particle semantics follow wowdev.wiki and WebWowViewerCpp.

import type {
  ParticleCurve,
  ParticleEmitterMeta,
  ParticleTrack,
} from "../types";

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

const lerp = (a: number[], b: number[], factor: number) =>
  a.map((value, index) => value + ((b[index] ?? value) - value) * factor);
const asArray = (value: number | number[]) =>
  typeof value === "number" ? [value] : value;

export function sampleTrack(
  track: ParticleTrack | undefined,
  timeMs: number,
  fallback: number[],
): number[] {
  if (!track?.keys.length) return fallback;
  const time =
    track.durationMs > 0
      ? ((timeMs % track.durationMs) + track.durationMs) % track.durationMs
      : timeMs;
  const first = track.keys[0];
  if (!first || time <= (first[0] ?? 0)) return first?.slice(1) ?? fallback;
  for (let index = 1; index < track.keys.length; index += 1) {
    const before = track.keys[index - 1];
    const after = track.keys[index];
    if (!before || !after || time >= (after[0] ?? 0)) continue;
    if (track.interpolation === 0) return before.slice(1);
    const start = before[0] ?? 0;
    const end = after[0] ?? start;
    return lerp(
      before.slice(1),
      after.slice(1),
      end === start ? 1 : (time - start) / (end - start),
    );
  }
  return track.keys.at(-1)?.slice(1) ?? fallback;
}

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
    return lerp(
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
): Particle {
  const areaX = one(emitter, "areaX", timeMs);
  const areaY = one(emitter, "areaY", timeMs);
  const vertical = one(emitter, "verticalRange", timeMs);
  const horizontal = one(emitter, "horizontalRange", timeMs);
  const zSource = one(emitter, "zSource", timeMs);
  let position = [0, 0, 0];
  let direction = [0, 0, 1];
  if (emitter.emitterType === 1) {
    position = [(signed(random) * areaX) / 2, (signed(random) * areaY) / 2, 0];
    const polar = signed(random) * vertical;
    const azimuth = signed(random) * horizontal;
    direction = [
      Math.sin(polar) * Math.cos(azimuth),
      Math.sin(polar) * Math.sin(azimuth),
      Math.cos(polar),
    ];
  } else if (emitter.emitterType === 2) {
    const radius = Math.min(areaX, areaY) + random() * Math.abs(areaY - areaX);
    const elevation = signed(random) * vertical;
    const azimuth = signed(random) * horizontal;
    position = [
      radius * Math.cos(elevation) * Math.cos(azimuth),
      radius * Math.cos(elevation) * Math.sin(azimuth),
      radius * Math.sin(elevation),
    ];
    const length = Math.hypot(...position);
    if (length > 0) direction = position.map((value) => value / length);
  }
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
): EmitterState {
  return {
    emitter,
    particles: [],
    owed: 0,
    timeMs: 0,
    random: rng(seed),
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
      state.particles.push(spawn(emitter, state.timeMs, state.random));
  }
}

export function simulateTo(
  emitter: ParticleEmitterMeta,
  seed: number,
  time: number,
): EmitterState {
  const state = createState(emitter, seed);
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
