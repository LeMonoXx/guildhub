import type { ReactNode } from "react";

/** Lets a card light up its people on the map and fly the map to it. */
export interface Spotlight {
  readonly active: boolean;
  readonly onHover: (on: boolean) => void;
  readonly onSelect: () => void;
}

export function SpotlightTitle({
  spotlight,
  children,
}: {
  readonly spotlight: Spotlight | undefined;
  readonly children: ReactNode;
}) {
  if (spotlight === undefined) return <h3>{children}</h3>;
  return (
    <h3>
      <button
        type="button"
        className="party-spotlight"
        aria-pressed={spotlight.active}
        onClick={spotlight.onSelect}
        onPointerEnter={() => {
          spotlight.onHover(true);
        }}
        onPointerLeave={() => {
          spotlight.onHover(false);
        }}
        onFocus={() => {
          spotlight.onHover(true);
        }}
        onBlur={() => {
          spotlight.onHover(false);
        }}
      >
        {children}
      </button>
    </h3>
  );
}
