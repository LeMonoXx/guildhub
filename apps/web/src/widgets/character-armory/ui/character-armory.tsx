import type { EquippedItem } from "@guildhub/contracts";
import { useState, type ReactNode } from "react";
import {
  firstArmorySelection,
  itemsBySlot,
  paperDollSlots,
  type PaperDollSlot,
} from "../../../entities/character";
import { GearSummaryPanel } from "./gear-summary-panel";
import { ItemDetail } from "./item-detail";
import { SlotButton } from "./slot-button";

interface CharacterArmoryProps {
  readonly items: readonly EquippedItem[];
  /** The selected item's own model, in the middle of the doll. */
  readonly renderModel?: (item: EquippedItem) => ReactNode;
}

export function CharacterArmory({ items, renderModel }: CharacterArmoryProps) {
  const bySlot = itemsBySlot(items);
  const [selected, setSelected] = useState<string | undefined>(
    () => firstArmorySelection(items)?.slot,
  );
  const selectedItem = selected ? bySlot.get(selected) : undefined;
  const slotProps = (
    slot: PaperDollSlot,
    side: "left" | "right" | "bottom",
    index: number,
  ) => ({
    slot,
    item: bySlot.get(slot),
    side,
    index,
    selected: selected === slot,
    onSelect: setSelected,
  });

  return (
    <div className="armory">
      <GearSummaryPanel items={items} />
      <div className="paper-doll">
        <ol className="paper-doll-column" data-side="left">
          {paperDollSlots.left.map((slot, index) => (
            <SlotButton key={slot} {...slotProps(slot, "left", index)} />
          ))}
        </ol>
        <div className="paper-doll-stage">
          {selectedItem ? (
            <ItemDetail
              item={selectedItem}
              model={renderModel ? renderModel(selectedItem) : null}
            />
          ) : null}
        </div>
        <ol className="paper-doll-column" data-side="right">
          {paperDollSlots.right.map((slot, index) => (
            <SlotButton key={slot} {...slotProps(slot, "right", index + 8)} />
          ))}
        </ol>
        <ol className="paper-doll-weapons">
          {paperDollSlots.weapons.map((slot, index) => (
            <SlotButton key={slot} {...slotProps(slot, "bottom", index + 16)} />
          ))}
        </ol>
      </div>
    </div>
  );
}
