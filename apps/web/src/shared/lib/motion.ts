import { useEffect, useRef, useState, type RefObject } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia(reducedMotionQuery).matches;

/**
 * `true` once the element has scrolled into view. Without an
 * IntersectionObserver, or with reduced motion, it is visible at once.
 */
export const useInView = <T extends Element>(
  options: { readonly once?: boolean; readonly rootMargin?: string } = {},
): [RefObject<T | null>, boolean] => {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(
    () =>
      typeof globalThis.IntersectionObserver !== "function" ||
      prefersReducedMotion(),
  );
  const once = options.once ?? true;
  const rootMargin = options.rootMargin ?? "0px 0px -12% 0px";

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof globalThis.IntersectionObserver !== "function") {
      return;
    }
    if (once && visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && once) observer.disconnect();
          if (entry.isIntersecting || !once) setVisible(entry.isIntersecting);
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [once, rootMargin, visible]);

  return [ref, visible];
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Counts from 0 to `target` once `active` turns true. */
export const useCountUp = (
  target: number,
  active: boolean,
  durationMs = 1400,
): number => {
  const [value, setValue] = useState(0);
  const still = prefersReducedMotion();
  const instant = still || typeof requestAnimationFrame !== "function";

  useEffect(() => {
    if (!active || instant) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs);
      setValue(target * easeOutCubic(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, durationMs, instant, target]);

  if (still) return target;
  if (instant) return active ? target : 0;
  return value;
};
