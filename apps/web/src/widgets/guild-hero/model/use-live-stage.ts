import { useEffect, useState, type RefObject } from "react";
import {
  canUseLiveStage,
  detectWebGL,
  liveStageMediaQuery,
} from "../../../shared/lib";

const mediaMatchesNow = () =>
  typeof matchMedia === "function" && matchMedia(liveStageMediaQuery).matches;

export interface LiveStageState {
  /** The device may ever show the 3D stage; layout follows this, not scrolling. */
  readonly capable: boolean;
  /** The 3D stage renders right now. */
  readonly live: boolean;
}

export const useLiveStage = (
  stageRef: RefObject<HTMLElement | null>,
): LiveStageState => {
  const [webgl] = useState(detectWebGL);
  const [visible, setVisible] = useState(false);
  const [mediaMatches, setMediaMatches] = useState(mediaMatchesNow);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia(liveStageMediaQuery);
    const syncMedia = () => {
      setMediaMatches(media.matches);
    };
    syncMedia();
    media.addEventListener("change", syncMedia);
    return () => {
      media.removeEventListener("change", syncMedia);
    };
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry?.isIntersecting ?? false);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [stageRef]);

  return {
    capable: webgl && mediaMatches,
    live: canUseLiveStage({ webgl, visible, mediaMatches }),
  };
};
