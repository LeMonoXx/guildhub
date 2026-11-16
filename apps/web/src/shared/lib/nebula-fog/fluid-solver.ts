import type { FogTuning } from "../fog-tuning";
import type { FigureSplats } from "./figure-splats";
import {
  advectShader,
  clearShader,
  curlShader,
  divergenceShader,
  forceShader,
  gradientShader,
  pressureShader,
  restShader,
  vorticityShader,
} from "./fluid-shaders";
import type { PassRunner } from "./gl-pass";
import type { Program } from "./gl-program";
import {
  swap,
  type DoubleTarget,
  type Target,
  type TargetPool,
} from "./gl-targets";
import type { PointerSplat } from "./splat-input";

/** How strongly existing curls are reinforced. */
const CURL = 9;
const VELOCITY_DISSIPATION = 0.9;
/** Share of the resting fog restored per second where the pointer wiped it. */
const REFILL = 0.35;
/** Pointer push, in grid cells per second per unit of pointer travel. */
const SPLAT_FORCE = 2600;
const SPLAT_RADIUS = 0.0026;
/** How much fog the pointer core clears per second. */
const WIPE = 0.8;

export interface FluidFields {
  readonly velocity: DoubleTarget;
  readonly density: DoubleTarget;
  readonly pressure: DoubleTarget;
  readonly curl: Target;
  readonly divergence: Target;
}

export interface SolverSettings {
  readonly veilLayer: boolean;
  readonly pressureIterations: number;
  readonly depth: number;
  readonly tuning: FogTuning;
}

export interface StepInput {
  readonly dt: number;
  readonly time: number;
  readonly aspect: number;
  /** The stage floor in uv (y up). */
  readonly floor: number;
  readonly pointer: PointerSplat;
  readonly scrollPush: number;
  readonly figures: FigureSplats;
}

export interface FluidSolver {
  readonly fields: () => FluidFields;
  /** Reallocates every field; the next step restarts from the resting fog. */
  readonly resize: (
    simWidth: number,
    simHeight: number,
    dyeWidth: number,
    dyeHeight: number,
  ) => void;
  readonly step: (input: StepInput) => void;
}

interface SolverPrograms {
  readonly curl: Program;
  readonly vorticity: Program;
  readonly force: Program;
  readonly divergence: Program;
  readonly clear: Program;
  readonly pressure: Program;
  readonly gradient: Program;
  readonly advect: Program;
  readonly rest: Program;
}

/**
 * Stable Fluids on the GPU: vorticity confinement, external forces, pressure
 * projection, then semi-Lagrangian advection of velocity and density.
 */
export const createFluidSolver = (
  gl: WebGL2RenderingContext,
  build: (fragmentSource: string) => Program,
  targets: TargetPool,
  pass: PassRunner,
  settings: SolverSettings,
): FluidSolver => {
  const programs: SolverPrograms = {
    curl: build(curlShader),
    vorticity: build(vorticityShader),
    force: build(forceShader),
    divergence: build(divergenceShader),
    clear: build(clearShader),
    pressure: build(pressureShader),
    gradient: build(gradientShader),
    advect: build(advectShader),
    rest: build(restShader),
  };
  const { veilLayer, tuning } = settings;
  const layer = veilLayer ? 1 : 0;
  let fields: FluidFields | undefined;
  let primed = false;

  const resize = (
    simWidth: number,
    simHeight: number,
    dyeWidth: number,
    dyeHeight: number,
  ) => {
    targets.free();
    const velocity = targets.double(simWidth, simHeight);
    const pressure = targets.double(simWidth, simHeight);
    const curl = targets.target(simWidth, simHeight);
    const divergence = targets.target(simWidth, simHeight);
    const density = targets.double(dyeWidth, dyeHeight);
    fields = { velocity, density, pressure, curl, divergence };
    primed = false;
  };

  const current = (): FluidFields => {
    if (!fields) throw new Error("The fluid solver was stepped before resize.");
    return fields;
  };

  const confineVorticity = (f: FluidFields, dt: number) => {
    const { curl, vorticity } = programs;
    pass.use(curl, f.velocity.texel);
    pass.sampler(curl, "uVelocity", f.velocity.read.texture);
    pass.draw(f.curl);

    pass.use(vorticity, f.velocity.texel);
    pass.sampler(vorticity, "uVelocity", f.velocity.read.texture);
    pass.sampler(vorticity, "uCurl", f.curl.texture);
    gl.uniform1f(
      vorticity.uniform("uCurlStrength"),
      veilLayer ? CURL * 0.4 : CURL,
    );
    gl.uniform1f(vorticity.uniform("uDt"), dt);
    pass.draw(f.velocity.write);
    swap(f.velocity);
  };

  const applyForces = (f: FluidFields, input: StepInput, moved: boolean) => {
    const { force } = programs;
    const { pointer, figures, dt } = input;
    pass.use(force, f.velocity.texel);
    pass.sampler(force, "uVelocity", f.velocity.read.texture);
    gl.uniform1f(force.uniform("uTime"), input.time);
    gl.uniform1f(force.uniform("uAspect"), input.aspect);
    gl.uniform1f(force.uniform("uDt"), dt);
    gl.uniform2f(force.uniform("uPointer"), pointer.x, pointer.y);
    gl.uniform2f(
      force.uniform("uPush"),
      moved ? pointer.dx * SPLAT_FORCE * tuning.mouse : 0,
      moved ? pointer.dy * SPLAT_FORCE * tuning.mouse : 0,
    );
    gl.uniform1f(force.uniform("uRadius"), SPLAT_RADIUS);
    gl.uniform1f(force.uniform("uScrollPush"), input.scrollPush);
    gl.uniform4fv(force.uniform("uFigures"), figures.data);
    gl.uniform2fv(force.uniform("uFigureVelocity"), figures.velocity);
    gl.uniform1i(force.uniform("uFigureCount"), figures.count);
    gl.uniform1f(force.uniform("uFigureForce"), tuning.figures);
    gl.uniform1f(force.uniform("uLayer"), layer);
    pass.draw(f.velocity.write);
    swap(f.velocity);
  };

  const project = (f: FluidFields) => {
    const { divergence, clear, pressure, gradient } = programs;
    pass.use(divergence, f.velocity.texel);
    pass.sampler(divergence, "uVelocity", f.velocity.read.texture);
    pass.draw(f.divergence);

    pass.use(clear, f.velocity.texel);
    pass.sampler(clear, "uSource", f.pressure.read.texture);
    gl.uniform1f(clear.uniform("uValue"), 0.8);
    pass.draw(f.pressure.write);
    swap(f.pressure);

    pass.use(pressure, f.velocity.texel);
    for (let i = 0; i < settings.pressureIterations; i += 1) {
      pass.rewind();
      pass.sampler(pressure, "uDivergence", f.divergence.texture);
      pass.sampler(pressure, "uPressure", f.pressure.read.texture);
      pass.draw(f.pressure.write);
      swap(f.pressure);
    }

    pass.use(gradient, f.velocity.texel);
    pass.sampler(gradient, "uPressure", f.pressure.read.texture);
    pass.sampler(gradient, "uVelocity", f.velocity.read.texture);
    pass.draw(f.velocity.write);
    swap(f.velocity);
  };

  const advect = (
    f: FluidFields,
    field: DoubleTarget,
    dissipation: number,
    dt: number,
  ) => {
    const program = programs.advect;
    pass.use(program, field.texel);
    pass.sampler(program, "uVelocity", f.velocity.read.texture);
    pass.sampler(program, "uSource", field.read.texture);
    gl.uniform2f(
      program.uniform("uVelocityTexel"),
      f.velocity.texel[0],
      f.velocity.texel[1],
    );
    gl.uniform1f(program.uniform("uDt"), dt);
    gl.uniform1f(program.uniform("uDissipation"), dissipation);
    pass.draw(field.write);
    swap(field);
  };

  const restoreDensity = (f: FluidFields, input: StepInput, moved: boolean) => {
    const { rest } = programs;
    const { pointer, figures, dt } = input;
    const troop = figures.troop;
    pass.use(rest, f.density.texel);
    pass.sampler(rest, "uDensity", f.density.read.texture);
    gl.uniform1f(rest.uniform("uTime"), input.time);
    gl.uniform1f(rest.uniform("uAspect"), input.aspect);
    // In front, stirred fog fades slowly, so plumes drift a while before they go.
    const refill = veilLayer ? REFILL * 0.6 : REFILL;
    gl.uniform1f(rest.uniform("uRefill"), primed ? refill * dt : 1);
    gl.uniform1f(rest.uniform("uFloor"), input.floor);
    gl.uniform2f(rest.uniform("uPointer"), pointer.x, pointer.y);
    const speed = Math.hypot(pointer.dx, pointer.dy);
    gl.uniform1f(
      rest.uniform("uWipe"),
      moved
        ? Math.min(0.5, WIPE * tuning.mouse * dt * Math.min(1, speed * 60))
        : 0,
    );
    gl.uniform1f(rest.uniform("uRadius"), SPLAT_RADIUS);
    gl.uniform4fv(rest.uniform("uFigures"), figures.data);
    gl.uniform1i(rest.uniform("uFigureCount"), figures.count);
    gl.uniform1f(rest.uniform("uStage"), tuning.stage);
    gl.uniform1f(rest.uniform("uLayer"), layer);
    gl.uniform4f(
      rest.uniform("uTroop"),
      troop.x0,
      troop.y0,
      troop.x1,
      troop.y1,
    );
    gl.uniform1f(rest.uniform("uDepth"), settings.depth);
    gl.uniform2fv(rest.uniform("uFigureVelocity"), figures.velocity);
    gl.uniform1f(rest.uniform("uDt"), dt);
    pass.draw(f.density.write);
    swap(f.density);
    primed = true;
  };

  const step = (input: StepInput) => {
    const f = current();
    const moved = input.pointer.moved && input.pointer.on;
    gl.disable(gl.BLEND);
    confineVorticity(f, input.dt);
    applyForces(f, input, moved);
    project(f);
    // In front, motion settles quickly: fog drifts, it does not whirl.
    advect(
      f,
      f.velocity,
      veilLayer ? VELOCITY_DISSIPATION * 1.2 : VELOCITY_DISSIPATION,
      input.dt,
    );
    advect(f, f.density, 0, input.dt);
    restoreDensity(f, input, moved);
  };

  return { fields: current, resize, step };
};
