import { useEffect, useRef, useState } from "react";
import {
  loadCharacterModel,
  mountModelStage,
  type ModelStageState,
} from "../model/model-stage";

/** EmoteCheer, then EmoteWave for looks baked before cheering was. */
const CHEER_ANIMATIONS = [68, 67] as const;

export interface CelebrationModelProps {
  /** The member's baked look. */
  readonly manifestUrl: string;
  readonly assetBase: string;
  readonly className?: string;
}

/** A member cheering in their own look. */
export function CelebrationModel({
  manifestUrl,
  assetBase,
  className,
}: CelebrationModelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<ModelStageState>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountModelStage(
      canvas,
      () => loadCharacterModel(manifestUrl, assetBase, CHEER_ANIMATIONS),
      setState,
    );
  }, [assetBase, manifestUrl]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-state={state}
      aria-hidden="true"
    />
  );
}
