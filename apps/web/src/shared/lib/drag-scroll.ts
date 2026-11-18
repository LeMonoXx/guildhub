import { useEffect, type RefObject } from "react";

/** Below this, a press is still a click on whatever is under it. */
const DRAG_THRESHOLD = 6;

/** Lets a mouse pan a horizontally scrolling element by dragging it. */
export function useDragScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let start: { x: number; left: number; id: number } | undefined;
    let dragging = false;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      start = {
        x: event.clientX,
        left: element.scrollLeft,
        id: event.pointerId,
      };
      dragging = false;
    };
    const move = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      if (!dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!dragging) {
        dragging = true;
        element.setPointerCapture(event.pointerId);
        element.dataset.dragging = "true";
      }
      element.scrollLeft = start.left - dx;
    };
    const up = () => {
      start = undefined;
      delete element.dataset.dragging;
      setTimeout(() => {
        dragging = false;
      });
    };
    const swallowClick = (event: MouseEvent) => {
      if (!dragging) return;
      dragging = false;
      event.stopPropagation();
      event.preventDefault();
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("click", swallowClick, true);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("click", swallowClick, true);
    };
  }, [ref]);
}
