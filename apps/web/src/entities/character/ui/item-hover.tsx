import type { EquippedItem } from "@guildhub/contracts";
import { useQuery } from "@tanstack/react-query";
import { useId, useState, type ReactNode } from "react";
import { characterQueries } from "../api/client";
import { ItemTooltip } from "./item-tooltip";

interface ItemHoverProps {
  /** What is known without asking: shown until the full tooltip arrives. */
  readonly item: EquippedItem;
  readonly children: ReactNode;
}

/** Wraps an item mention; hovering or focusing it loads the in-game tooltip. */
export function ItemHover({ item, children }: ItemHoverProps) {
  const tooltipId = useId();
  const [wanted, setWanted] = useState(false);
  const full = useQuery({
    ...characterQueries.item(item.itemId),
    enabled: wanted,
  });
  const want = () => {
    setWanted(true);
  };
  return (
    <button
      type="button"
      className="item-hover"
      aria-describedby={tooltipId}
      onPointerEnter={want}
      onFocus={want}
    >
      {children}
      <span className="item-hover-tip">
        <ItemTooltip item={full.data ?? item} id={tooltipId} />
      </span>
    </button>
  );
}
