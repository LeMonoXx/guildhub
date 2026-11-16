/*
 * Page fog as a real fluid: a GPU solver for the incompressible Navier-Stokes
 * equations after Jos Stam's "Stable Fluids" (semi-Lagrangian advection,
 * Jacobi pressure projection) with vorticity confinement for curling wisps.
 *
 * Why custom code: no maintained package renders a translucent fog layer
 * without pulling in Three.js (which stays confined to the character adapters,
 * see web-three-adapter-boundary) or a full colour-splat demo. This folder is the
 * smallest solver that gives the fog real motion: the pointer pushes and stirs
 * it, the wake swirls and slowly fills in again, scrolling drags it along.
 */

import { readFogTuning } from "../fog-tuning";
import { FigureSplats } from "./figure-splats";
import { clearOutput, createFluidDisplay } from "./fluid-display";
import { displayShader, vertexShader } from "./fluid-shaders";
import { createFluidSolver } from "./fluid-solver";
import { createFullScreenTriangle, createPassRunner } from "./gl-pass";
import { createProgramBuilder } from "./gl-program";
import { createTargetPool } from "./gl-targets";
import { PointerSplat, ScrollSplat, type Viewport } from "./splat-input";

export interface FluidFogOptions {
  readonly reducedMotion: boolean;
  /** Canvas pixels per CSS pixel for the final, lit image. */
  readonly resolution: number;
  /**
   * "page": the fog behind all content. "veil": the same fog in front of the
   * character stage, resting as a deep bank around the troop and nowhere else.
   */
  readonly layer?: "page" | "veil";
  /** The veil draws only inside this box (viewport pixels) and sleeps while it is off screen. */
  readonly region?: () => DOMRect | null;
  /** Veil opacity, 0 to 1. */
  readonly opacity?: number;
  /** How high the veil bank reaches: 1 is above the hips. */
  readonly depth?: number;
}

/** Velocity grid width; height follows the window's aspect ratio. */
const SIM_WIDTH = 176;
/** Fog density grid width; finer than the velocity grid for crisp wisps. */
const DYE_WIDTH = 384;
const PRESSURE_ITERATIONS = 18;

/**
 * Runs the fog fluid in a WebGL 2 context that can render to half-float
 * textures. Returns a stop function. Throws when the context cannot.
 */
export const startFluidFog = (
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  options: FluidFogOptions,
): (() => void) => {
  const output = canvas;
  const veilLayer = options.layer === "veil";
  // The veil only covers the stage: a coarser grid looks the same there.
  const simWidth = veilLayer ? 128 : SIM_WIDTH;
  const dyeWidth = veilLayer ? 320 : DYE_WIDTH;
  const pressureIterations = veilLayer ? 12 : PRESSURE_ITERATIONS;
  let regionRect: DOMRect | null = null;
  let asleep = false;
  if (!gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("Half-float render targets are unavailable.");
  }

  const tuning = readFogTuning();
  const programs = createProgramBuilder(gl, vertexShader);
  const targets = createTargetPool(gl);
  const pass = createPassRunner(gl);
  const solver = createFluidSolver(gl, programs.build, targets, pass, {
    veilLayer,
    pressureIterations,
    depth: options.depth ?? 1,
    tuning,
  });
  const render = createFluidDisplay(
    gl,
    programs.build(displayShader),
    pass,
    output,
    {
      veilLayer,
      reducedMotion: options.reducedMotion,
      opacity: options.opacity ?? 1,
      tuning,
    },
  );
  const disposeTriangle = createFullScreenTriangle(gl);

  const viewport: Viewport = { width: 1, height: 1 };
  const pointer = new PointerSplat(viewport);
  const scroll = new ScrollSplat();
  const figures = new FigureSplats(veilLayer, simWidth);
  let frame = 0;
  let last = performance.now();

  const resize = () => {
    viewport.width = canvas.clientWidth || globalThis.innerWidth;
    viewport.height = canvas.clientHeight || globalThis.innerHeight;
    output.width = Math.max(1, Math.round(viewport.width * options.resolution));
    output.height = Math.max(
      1,
      Math.round(viewport.height * options.resolution),
    );
    const aspect = viewport.height / viewport.width;
    const simHeight = Math.max(32, Math.round(simWidth * aspect));
    const dyeHeight = Math.max(64, Math.round(dyeWidth * aspect));
    solver.resize(simWidth, simHeight, dyeWidth, dyeHeight);
  };

  const step = (dt: number, time: number) => {
    figures.update(
      dt,
      viewport,
      1 / solver.fields().velocity.texel[1],
      regionRect,
    );
    solver.step({
      dt,
      time,
      aspect: viewport.width / viewport.height,
      floor:
        1 - (viewport.height * 0.86 - globalThis.scrollY) / viewport.height,
      pointer,
      scrollPush: scroll.push,
      figures,
    });
    pointer.consume();
    scroll.consume();
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (veilLayer) {
      regionRect = options.region?.() ?? null;
      if (
        !regionRect ||
        regionRect.bottom < 0 ||
        regionRect.top > viewport.height
      ) {
        if (!asleep) {
          clearOutput(gl, output);
          asleep = true;
        }
        last = now;
        return;
      }
      asleep = false;
    }
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    scroll.sample();
    step(dt, now / 1000);
    render({
      now,
      viewport,
      pointer,
      troop: figures.troop,
      density: solver.fields().density,
      region: regionRect,
    });
  };

  resize();
  globalThis.addEventListener("resize", resize);
  globalThis.addEventListener("pointermove", pointer.onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", pointer.onLeave);
  frame = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(frame);
    globalThis.removeEventListener("resize", resize);
    globalThis.removeEventListener("pointermove", pointer.onMove);
    document.documentElement.removeEventListener(
      "pointerleave",
      pointer.onLeave,
    );
    targets.free();
    programs.dispose();
    disposeTriangle();
  };
};
