import type { CSSProperties, RefObject } from "react";

/** A stable melt: each letter drips a different way, the same way every visit. */
function drift(index: number): { x: string; y: string; rot: string } {
  const angle = (index * 137.5 * Math.PI) / 180;
  const side = index % 2 === 0 ? 1 : -1;
  return {
    x: `${String(Math.round(side * (16 + (index % 5) * 12 + Math.cos(angle) * 8)))}px`,
    y: `${String(Math.round(18 + (index % 4) * 14 + Math.sin(angle) * 8))}px`,
    rot: `${String(((index % 7) - 3) * 7)}deg`,
  };
}

export function FogLine({
  text,
  lineRef,
}: {
  readonly text: string;
  readonly lineRef: RefObject<HTMLParagraphElement | null>;
}) {
  return (
    <p ref={lineRef} className="fog-line" aria-hidden="true">
      {Array.from(text).map((char, index) => {
        const shift = drift(index);
        return (
          <span
            key={`${char}-${String(index)}`}
            style={
              {
                ["--i"]: String(index),
                ["--dx"]: shift.x,
                ["--dy"]: shift.y,
                ["--rot"]: shift.rot,
              } as CSSProperties
            }
          >
            {char === " " ? "\u00a0" : char}
          </span>
        );
      })}
    </p>
  );
}
