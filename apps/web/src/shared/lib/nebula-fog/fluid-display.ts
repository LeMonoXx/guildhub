import type { FogTuning } from "../fog-tuning";
import type { Troop } from "./figure-splats";
import type { PassRunner } from "./gl-pass";
import type { Program } from "./gl-program";
import type { DoubleTarget } from "./gl-targets";
import type { PointerSplat, Viewport } from "./splat-input";

export interface DisplaySettings {
  readonly veilLayer: boolean;
  readonly reducedMotion: boolean;
  readonly opacity: number;
  readonly tuning: FogTuning;
}

export interface DisplayFrame {
  readonly now: number;
  readonly viewport: Viewport;
  readonly pointer: PointerSplat;
  readonly troop: Troop;
  readonly density: DoubleTarget;
  readonly region: DOMRect | null;
}

export const clearOutput = (
  gl: WebGL2RenderingContext,
  output: HTMLCanvasElement,
) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, output.width, output.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
};

/** Light the density field onto the canvas; the lantern eases toward the pointer and now and then gutters. */
export const createFluidDisplay = (
  gl: WebGL2RenderingContext,
  display: Program,
  pass: PassRunner,
  output: HTMLCanvasElement,
  settings: DisplaySettings,
): ((frame: DisplayFrame) => void) => {
  const { veilLayer } = settings;
  const lamp = { x: 0, y: 0, ready: false };
  let flicker = 1;

  return ({ now, viewport, pointer, troop, density, region }) => {
    const aim = pointer.on
      ? {
          x: pointer.x * viewport.width,
          y: (1 - pointer.y) * viewport.height,
        }
      : {
          x: viewport.width * (0.5 + 0.22 * Math.sin(now * 0.00023)),
          y: viewport.height * (0.5 + 0.14 * Math.cos(now * 0.00031)),
        };
    if (!lamp.ready) {
      lamp.x = aim.x;
      lamp.y = aim.y;
      lamp.ready = true;
    }
    lamp.x += (aim.x - lamp.x) * 0.055;
    lamp.y += (aim.y - lamp.y) * 0.055;
    if (!settings.reducedMotion && Math.random() < 0.004) {
      flicker = 0.45 + Math.random() * 0.3;
    }
    flicker += (1 - flicker) * 0.06;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    pass.use(display, density.texel);
    pass.sampler(display, "uDensity", density.read.texture);
    gl.uniform2f(display.uniform("uViewport"), viewport.width, viewport.height);
    gl.uniform1f(display.uniform("uScroll"), globalThis.scrollY);
    gl.uniform1f(display.uniform("uTime"), now / 1000);
    gl.uniform2f(display.uniform("uLamp"), lamp.x, lamp.y);
    gl.uniform1f(display.uniform("uLampRadius"), 440);
    gl.uniform1f(display.uniform("uFlicker"), flicker);
    gl.uniform3f(display.uniform("uFog"), 0.62, 0.7, 0.74);
    gl.uniform3f(display.uniform("uLight"), 0.7, 0.86, 0.9);
    gl.uniform4f(
      display.uniform("uTroop"),
      troop.x0,
      troop.y0,
      troop.x1,
      troop.y1,
    );
    gl.uniform1f(
      display.uniform("uBehind"),
      veilLayer ? 1 : Math.min(1, settings.tuning.behind),
    );
    gl.uniform1f(display.uniform("uLayer"), veilLayer ? 1 : 0);
    gl.uniform1f(display.uniform("uOpacity"), settings.opacity);
    if (region) {
      gl.uniform4f(
        display.uniform("uRegion"),
        region.left,
        region.top,
        region.right,
        region.bottom,
      );
    }
    clearOutput(gl, output);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
};
