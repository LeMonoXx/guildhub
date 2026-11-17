import { useEffect, useRef, useState } from "react";
import { mountBossStage, type BossState } from "../model/boss-stage";

export interface BossModelProps {
  /** The creature display the baker wrote under `bosses/v1/`. */
  readonly displayId: number;
  readonly assetBase: string;
  readonly className?: string;
}

/** A dungeon boss standing in its idle animation; draws nothing while no bake exists. */
export function BossModel({ displayId, assetBase, className }: BossModelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<BossState>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountBossStage(canvas, { displayId, assetBase, onState: setState });
  }, [assetBase, displayId]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      data-state={state}
      aria-hidden="true"
    />
  );
}
