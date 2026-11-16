import type { EquippedItem } from "@guildhub/contracts";
import { useState, type ReactNode } from "react";
import {
  ItemIcon,
  ItemTooltip,
  Money,
  durabilityShare,
  itemQualityColorVar,
  itemsBySlot,
  paperDollSlots,
  qualityBreakdown,
  type PaperDollSlot,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber, wowheadUrl } from "../../../shared/lib";
import { Meter, Reveal } from "../../../shared/ui";

interface CharacterArmoryProps {
  readonly items: readonly EquippedItem[];
  /** The selected item's own model, in the middle of the doll. */
  readonly renderModel?: (item: EquippedItem) => ReactNode;
}

const firstSelection = (
  items: readonly EquippedItem[],
): EquippedItem | undefined =>
  items.find((item) => item.slot === "MAIN_HAND") ??
  [...items].sort(
    (left, right) => (right.itemLevel ?? 0) - (left.itemLevel ?? 0),
  )[0];

function SlotButton({
  slot,
  item,
  side,
  selected,
  onSelect,
  index,
}: {
  readonly slot: PaperDollSlot;
  readonly item: EquippedItem | undefined;
  readonly side: "left" | "right" | "bottom";
  readonly selected: boolean;
  readonly onSelect: (slot: PaperDollSlot) => void;
  readonly index: number;
}) {
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

function ItemDetail({
  item,
  model,
}: {
  readonly item: EquippedItem;
  readonly model: ReactNode;
}) {
  const { t, locale } = useLocale();
  const durability = durabilityShare(item);
  return (
    <article
      key={item.slot}
      className="item-detail"
      style={{
        ["--item-quality" as string]: itemQualityColorVar(item.quality),
      }}
    >
      <div className="item-detail-hero">
        <div>
          <p className="eyebrow">{t(`slot.${item.slot}`)}</p>
          <h3 style={{ color: itemQualityColorVar(item.quality) }}>
            {item.name}
          </h3>
          <p className="item-detail-kind">
            {[item.qualityName, item.itemSubclass ?? item.itemClass]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {model}
      {durability === undefined || !item.durability ? null : (
        <Meter
          value={item.durability.current}
          max={item.durability.max}
          color={
            durability > 0.5
              ? "var(--color-signal)"
              : durability > 0.2
                ? "var(--color-gold)"
                : "var(--color-danger)"
          }
          label={t("armory.durability")}
          detail={`${String(item.durability.current)} / ${String(item.durability.max)}`}
        />
      )}
      <a
        className="item-detail-link"
        href={wowheadUrl("item", item.itemId, locale)}
        target="_blank"
        rel="noreferrer"
      >
        {t("armory.wowhead")}
      </a>
    </article>
  );
}

function GearSummary({ items }: { readonly items: readonly EquippedItem[] }) {
  const { t, locale } = useLocale();
  const levels = items
    .map((item) => item.itemLevel)
    .filter((level): level is number => level !== undefined);
  const average =
    levels.length > 0
      ? levels.reduce((sum, level) => sum + level, 0) / levels.length
      : 0;
  const worth = items.reduce(
    (sum, item) => sum + (item.sellPriceCopper ?? 0),
    0,
  );
  const worn = items.filter((item) => item.durability);
  const durability =
    worn.length > 0
      ? worn.reduce((sum, item) => sum + (durabilityShare(item) ?? 1), 0) /
        worn.length
      : undefined;
  const breakdown = qualityBreakdown(items);
  return (
    <Reveal className="gear-summary">
      <dl>
        <div>
          <dt>{t("armory.averageItemLevel")}</dt>
          <dd>{formatNumber(average, locale, 1)}</dd>
        </div>
        <div>
          <dt>{t("armory.equipped")}</dt>
          <dd>{items.length}</dd>
        </div>
        <div>
          <dt>{t("armory.vendorTotal")}</dt>
          <dd>
            <Money copper={worth} />
          </dd>
        </div>
        {durability === undefined ? null : (
          <div>
            <dt>{t("armory.durability")}</dt>
            <dd>{formatNumber(durability * 100, locale)}%</dd>
          </div>
        )}
      </dl>
      <div
        className="quality-spectrum"
        role="img"
        aria-label={breakdown
          .map(
            (entry) => `${String(entry.count)} ${entry.quality.toLowerCase()}`,
          )
          .join(", ")}
      >
        {breakdown.map((entry) => (
          <span
            key={entry.quality}
            style={{
              flexGrow: entry.count,
              ["--item-quality" as string]: itemQualityColorVar(entry.quality),
            }}
          >
            {entry.count}
          </span>
        ))}
      </div>
    </Reveal>
  );
}

export function CharacterArmory({ items, renderModel }: CharacterArmoryProps) {
  const bySlot = itemsBySlot(items);
  const [selected, setSelected] = useState<string | undefined>(
    () => firstSelection(items)?.slot,
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
      <GearSummary items={items} />
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
