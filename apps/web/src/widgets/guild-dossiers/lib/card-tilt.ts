import type { PointerEvent } from "react";
import { prefersReducedMotion } from "../../../shared/lib";

const MAX_TILT_X_DEG = 7;
const MAX_TILT_Y_DEG = 9;

/** Leans the card toward the pointer and moves its glare with it. */
export function tiltTowardPointer(event: PointerEvent<HTMLElement>): void {
  if (prefersReducedMotion()) return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width - 0.5;
  const y = (event.clientY - box.top) / box.height - 0.5;
  card.style.setProperty("--tilt-x", `${String(-y * MAX_TILT_X_DEG)}deg`);
  card.style.setProperty("--tilt-y", `${String(x * MAX_TILT_Y_DEG)}deg`);
  card.style.setProperty("--glare-x", `${String((x + 0.5) * 100)}%`);
  card.style.setProperty("--glare-y", `${String((y + 0.5) * 100)}%`);
}

export function resetTilt(event: PointerEvent<HTMLElement>): void {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
}
