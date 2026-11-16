import type { EquippedItem } from "@guildhub/contracts";
import type { ReactNode } from "react";
import {
  durabilityColorVar,
  durabilityShare,
  itemQualityColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { wowheadUrl } from "../../../shared/lib";
import { Meter } from "../../../shared/ui";

export function ItemDetail({
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
          color={durabilityColorVar(durability)}
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
