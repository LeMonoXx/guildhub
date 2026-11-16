import { useEffect, useRef } from "react";
import { readFogTuning } from "../lib/fog-tuning";
import { prefersReducedMotion } from "../lib/motion";

interface FogVeilProps {
  readonly className?: string;
}

/**
 * The page fog's twin in front of something (the character stage): the same
 * fluid simulation, resting as a deep bank around the bodies reported to the
 * fog channel, so figures stand inside the fog instead of in front of it. The
 * canvas covers the window (position it fixed); it draws only inside its
 * parent element and sleeps while that is off screen. It loads after first
 * paint and only where WebGL 2 can run the fluid; with reduced motion it stays
 * empty.
 */
export function FogVeil({ className }: FogVeilProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      prefersReducedMotion() ||
      typeof globalThis.WebGL2RenderingContext === "undefined"
    ) {
      return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;
    void import("../lib/nebula-fog/nebula-fog-fluid")
      .then(({ startFluidFog }) => {
        if (disposed) return;
        const gl = canvas.getContext("webgl2", {
          alpha: true,
          antialias: false,
          premultipliedAlpha: false,
          powerPreference: "low-power",
        });
        if (!gl) return;
        const tuning = readFogTuning();
        stop = startFluidFog(canvas, gl, {
          reducedMotion: false,
          resolution: 0.5,
          layer: "veil",
          region: () => canvas.parentElement?.getBoundingClientRect() ?? null,
          opacity: Math.min(1, 0.95 * tuning.veil),
          depth: Math.min(1.8, Math.max(0.3, tuning.stage)),
        });
      })
      .catch(() => {
        // Without the veil the stage simply stands in front of the fog.
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className ? `fog-veil ${className}` : "fog-veil"}
      aria-hidden="true"
    />
  );
}
