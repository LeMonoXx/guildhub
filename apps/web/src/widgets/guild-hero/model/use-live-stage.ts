import { useEffect, useState, type RefObject } from "react";
import {
  canUseLiveStage,
  detectWebGL,
  liveStageMediaQuery,
} from "../../../shared/lib";

export const useLiveStage = (
  stageRef: RefObject<HTMLElement | null>,
): boolean => {
  const [webgl, setWebgl] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mediaMatches, setMediaMatches] = useState(false);

  useEffect(() => {
    setWebgl(detectWebGL());
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

  return canUseLiveStage({ webgl, visible, mediaMatches });
};
