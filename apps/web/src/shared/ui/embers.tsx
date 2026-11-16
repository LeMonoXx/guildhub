import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../lib/motion";

interface EmbersProps {
  /** Particles per 100 000 px² of canvas. */
  readonly density?: number;
  readonly color?: string;
}

interface Ember {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  life: number;
}

const spawn = (width: number, height: number, fresh: boolean): Ember => ({
  x: Math.random() * width,
  y: fresh ? Math.random() * height : height + 8,
  radius: 0.6 + Math.random() * 1.8,
  speed: 0.18 + Math.random() * 0.55,
  drift: (Math.random() - 0.5) * 0.35,
  phase: Math.random() * Math.PI * 2,
  life: 0.35 + Math.random() * 0.65,
});

/** Slow rising sparks on a 2D canvas; stops offscreen and for reduced motion. */
export function Embers({ density = 5, color = "191 243 233" }: EmbersProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || prefersReducedMotion()) return;

    let embers: Ember[] = [];
    let frame = 0;
    let running = true;
    const resize = () => {
      const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(
        (canvas.clientWidth * canvas.clientHeight * density) / 100_000,
      );
      embers = Array.from({ length: Math.min(count, 140) }, () =>
        spawn(canvas.clientWidth, canvas.clientHeight, true),
      );
    };
    const draw = (time: number) => {
      if (!running) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      embers = embers.map((ember) => {
        const next = {
          ...ember,
          y: ember.y - ember.speed,
          x: ember.x + ember.drift + Math.sin(time / 1400 + ember.phase) * 0.2,
        };
        return next.y < -10 ? spawn(width, height, false) : next;
      });
      for (const ember of embers) {
        const fade = Math.min(1, ember.y / height + 0.1) * ember.life;
        const flicker = 0.65 + Math.sin(time / 260 + ember.phase) * 0.35;
        const glow = context.createRadialGradient(
          ember.x,
          ember.y,
          0,
          ember.x,
          ember.y,
          ember.radius * 4,
        );
        glow.addColorStop(0, `rgb(${color} / ${String(fade * flicker)})`);
        glow.addColorStop(1, `rgb(${color} / 0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(ember.x, ember.y, ember.radius * 4, 0, Math.PI * 2);
        context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry?.isIntersecting ?? false;
      if (!visible) {
        running = false;
        cancelAnimationFrame(frame);
        return;
      }
      if (running) return;
      running = true;
      frame = requestAnimationFrame(draw);
    });
    resize();
    observer.observe(canvas);
    globalThis.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      globalThis.removeEventListener("resize", resize);
    };
  }, [color, density]);

  return <canvas ref={canvasRef} className="embers" aria-hidden="true" />;
}
