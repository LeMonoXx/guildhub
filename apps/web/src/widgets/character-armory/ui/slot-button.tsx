import type { EquippedItem } from "@guildhub/contracts";
import {
  ItemIcon,
  ItemTooltip,
  itemQualityColorVar,
  type PaperDollSlot,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";

export interface SlotButtonProps {
  readonly slot: PaperDollSlot;
  readonly item: EquippedItem | undefined;
  readonly side: "left" | "right" | "bottom";
  readonly selected: boolean;
  readonly onSelect: (slot: PaperDollSlot) => void;
  readonly index: number;
}

export function SlotButton({
  slot,
  item,
  side,
  selected,
  onSelect,
  index,
}: SlotButtonProps) {
  const { t } = useLocale();
  const tooltipId = `tooltip-${slot}`;
  const slotLabel = t(`slot.${slot}`);
  return (
    <li
      className="paper-doll-slot"
      data-side={side}
      data-filled={item !== undefined}
      style={{ animationDelay: `${String(index * 45)}ms` }}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-describedby={item ? tooltipId : undefined}
        disabled={!item}
        onClick={() => {
          onSelect(slot);
        }}
      >
        <ItemIcon
          iconUrl={item?.iconUrl}
          quality={item?.quality}
          label={item?.name}
        />
        <span className="paper-doll-text">
          <span
            className="paper-doll-name"
            style={
              item ? { color: itemQualityColorVar(item.quality) } : undefined
            }
          >
            {item?.name ?? t("armory.empty")}
          </span>
          <span className="paper-doll-slot-name">
            {slotLabel}
            {item?.itemLevel === undefined
              ? ""
              : ` · ${t("armory.ilvl", { level: item.itemLevel })}`}
          </span>
        </span>
      </button>
      {item ? (
        <div className="paper-doll-tooltip">
          <ItemTooltip item={item} id={tooltipId} />
        </div>
      ) : null}
    </li>
  );
}
