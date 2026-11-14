import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";

/**
 * The page-wide fog behind all content. The renderer (and Three.js with it)
 * loads only after the first paint and only where WebGL exists; without it the
 * page keeps its plain dark ground. Reduced motion gets one still frame.
 */
export function NebulaFog() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof globalThis.WebGLRenderingContext === "undefined") {
      return;
    }
    let disposed = false;
    let stop: (() => void) | undefined;
    void import("../lib/nebula-fog-renderer")
      .then(({ startNebulaFog }) => {
        if (disposed) return;
        stop = startNebulaFog(canvas, {
          reducedMotion: prefersReducedMotion(),
        });
      })
      .catch(() => {
        // No fog is a valid look; the page stays fully usable without it.
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  return <canvas ref={canvasRef} className="nebula-fog" aria-hidden="true" />;
}
