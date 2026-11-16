import type { ItemQuality } from "@guildhub/contracts";
import { useEffect, useRef, useState } from "react";
import { ItemIcon } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import {
  mountItemTurntable,
  type TurntableSpin,
  type TurntableState,
} from "../model/item-turntable-stage";

export interface ItemTurntableProps {
  readonly manifest: string;
  readonly itemId: number;
  readonly assetBase: string;
  readonly iconUrl?: string;
  readonly quality?: ItemQuality;
}

const DRAG_RADIANS_PER_PIXEL = 0.01;

/** The selected item, turned by the pointer. Armor that is only a body texture stays an icon. */
export function ItemTurntable({
  manifest,
  itemId,
  assetBase,
  iconUrl,
  quality,
}: ItemTurntableProps) {
  const { t } = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spin = useRef<TurntableSpin>({ yaw: 0.5, dragging: false });
  const [state, setState] = useState<TurntableState>("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountItemTurntable(canvas, {
      manifest,
      itemId,
      assetBase,
      spin: spin.current,
      onState: setState,
    });
  }, [assetBase, itemId, manifest]);

  return (
    <div
      className="item-turntable"
      data-state={state}
      onPointerDown={(event) => {
        spin.current.dragging = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={() => {
        spin.current.dragging = false;
      }}
      onPointerCancel={() => {
        spin.current.dragging = false;
      }}
      onPointerMove={(event) => {
        if (!spin.current.dragging) return;
        spin.current.yaw += event.movementX * DRAG_RADIANS_PER_PIXEL;
      }}
    >
      <canvas ref={canvasRef} aria-hidden={state !== "ready"} />
      {state === "ready" ? (
        <p className="item-turntable-hint">{t("armory.turn")}</p>
      ) : (
        <div className="item-turntable-fallback">
          <ItemIcon iconUrl={iconUrl} quality={quality} size="lg" />
          <p>
            {state === "loading"
              ? t("armory.modelLoading")
              : t("armory.modelOnBody")}
          </p>
        </div>
      )}
    </div>
  );
}
