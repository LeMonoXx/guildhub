import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/** Pixels a press may wander and still count as a click rather than a drag. */
const DRAG_THRESHOLD = 5;
const WHEEL_SENSITIVITY = 0.0015;

export interface MapGestureHandlers {
  /** Moves the map by a distance in percent of the stage. */
  readonly onPan: (dx: number, dy: number) => void;
  /** Zooms around a stage spot (0..1); false when the zoom is already at its limit. */
  readonly onZoom: (factor: number, fx: number, fy: number) => boolean;
}

interface Press {
  readonly id: number;
  x: number;
  y: number;
  moved: boolean;
}

/** Drag to pan and wheel to zoom; a drag never ends in a click on what lies under it. */
export function useMapGestures(
  stage: RefObject<HTMLDivElement | null>,
  handlers: MapGestureHandlers,
) {
  const latest = useRef(handlers);
  const press = useRef<Press | undefined>(undefined);
  const swallowClick = useRef(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    const element = stage.current;
    if (element === null) return;
    const onWheel = (event: WheelEvent) => {
      const rect = element.getBoundingClientRect();
      const zoomed = latest.current.onZoom(
        Math.exp(-event.deltaY * WHEEL_SENSITIVITY),
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      );
      if (zoomed) event.preventDefault();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [stage]);

  const release = (event: PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (current?.id !== event.pointerId) return;
    swallowClick.current = current.moved;
    press.current = undefined;
    setDragging(false);
  };

  return {
    dragging,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        swallowClick.current = false;
        press.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        };
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const current = press.current;
        if (current?.id !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
          current.moved = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const rect = event.currentTarget.getBoundingClientRect();
        latest.current.onPan((dx / rect.width) * 100, (dy / rect.height) * 100);
        current.x = event.clientX;
        current.y = event.clientY;
      },
      onPointerUp: release,
      onPointerCancel: release,
      onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      },
    },
  };
}
