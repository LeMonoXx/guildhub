/*
 * The page-wide fog uses the browser's WebGL API directly because Three.js is
 * confined to the character rendering adapters (see .dependency-cruiser.cjs,
 * web-three-adapter-boundary) and a single textured-less quad needs none of
 * its scene graph. This module only picks the context and the fog that fits it.
 */

import { startFluidFog } from "./nebula-fog-fluid";
import { startNoiseFog } from "./noise-fog";

export interface NebulaFogOptions {
  /** Draw a single still frame and never animate. */
  readonly reducedMotion: boolean;
}

/** Fog is soft by nature: half resolution looks the same and costs a quarter. */
const RESOLUTION = 0.5;

const contextAttributes: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  premultipliedAlpha: false,
  powerPreference: "low-power",
};

/**
 * Starts the page fog. Capable browsers get the fluid simulation (the pointer
 * pushes and stirs real fog); reduced motion, or a context without half-float
 * render targets, gets the still or drifting noise fog.
 *
 * Renders into `canvas` until the returned stop function is called. Pauses
 * itself while the tab is hidden (requestAnimationFrame does). Throws when
 * WebGL is unavailable; callers treat that as "no fog".
 */
export const startNebulaFog = (
  canvas: HTMLCanvasElement,
  options: NebulaFogOptions,
): (() => void) => {
  const gl2 = canvas.getContext("webgl2", contextAttributes);
  if (gl2 && !options.reducedMotion) {
    try {
      return startFluidFog(canvas, gl2, { ...options, resolution: RESOLUTION });
    } catch {
      // Fall through to the noise fog in the same context.
    }
  }
  const gl = gl2 ?? canvas.getContext("webgl", contextAttributes);
  if (!gl) throw new Error("WebGL is unavailable.");
  return startNoiseFog(canvas, gl, { ...options, resolution: RESOLUTION });
};
