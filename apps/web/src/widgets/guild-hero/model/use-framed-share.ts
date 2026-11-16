import { useEffect, useState, type RefObject } from "react";

/** How much of the stage the camera frames; the padding below is only drawn into. */
export function useFramedShare(
  stageRef: RefObject<HTMLDivElement | null>,
  size: { readonly width: number; readonly height: number },
  live: boolean,
): number {
  const [share, setShare] = useState(1);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const frame = stage.querySelector(".cinematic-stage");
    if (!(frame instanceof HTMLElement)) return;
    const bleed = Number.parseFloat(getComputedStyle(frame).paddingBottom) || 0;
    const height = stage.clientHeight;
    if (height <= 0) return;
    setShare((height - bleed) / height);
  }, [stageRef, size.width, size.height, live]);
  return share;
}
