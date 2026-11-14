import type { EquippedItem } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { itemQualityColorVar } from "../model/item";
import { Money } from "./money";

interface ItemTooltipProps {
  readonly item: EquippedItem;
  readonly id?: string | undefined;
}

/** The in-game item tooltip, line for line. */
export function ItemTooltip({ item, id }: ItemTooltipProps) {
  const { t } = useLocale();
  const base = item.stats.filter((stat) => !stat.equipBonus);
  const bonuses = item.stats.filter((stat) => stat.equipBonus);
  const kind = item.itemSubclass ?? item.itemClass;
  return (
    <div className="wow-tooltip" role="tooltip" id={id}>
      <p
        className="wow-tooltip-name"
        style={{ color: itemQualityColorVar(item.quality) }}
      >
        {item.name}
      </p>
      {item.itemLevel === undefined ? null : (
        <p className="wow-tooltip-level">
          {t("item.level", { level: item.itemLevel })}
        </p>
      )}
      {item.binding ? <p>{item.binding}</p> : null}
      {item.inventoryType || kind ? (
        <p className="wow-tooltip-split">
          <span>{item.inventoryType ?? item.slotName}</span>
          {kind && kind !== item.itemClass ? <span>{kind}</span> : null}
        </p>
      ) : null}
      {item.weapon ? (
        <>
          <p className="wow-tooltip-split">
            <span>{item.weapon.damage}</span>
            {item.weapon.speed ? <span>{item.weapon.speed}</span> : null}
          </p>
          {item.weapon.dps ? <p>{item.weapon.dps}</p> : null}
        </>
      ) : null}
      {item.armor ? <p>{item.armor}</p> : null}
      {item.shieldBlock ? <p>{item.shieldBlock}</p> : null}
      {base.map((stat) => (
        <p key={`${stat.type}-${stat.label}`} style={{ color: stat.color }}>
          {stat.label}
        </p>
      ))}
      {item.enchantments.map((enchantment) => (
        <p key={enchantment} className="wow-tooltip-enchant">
          {enchantment}
        </p>
      ))}
      {item.durability ? (
        <p>
          {t("item.durability", {
            current: item.durability.current,
            max: item.durability.max,
          })}
        </p>
      ) : null}
      {item.requiredLevel ? (
        <p>{t("item.requiresLevel", { level: item.requiredLevel })}</p>
      ) : null}
      {bonuses.map((stat) => (
        <p
          key={`${stat.type}-${stat.label}`}
          className="wow-tooltip-bonus"
          style={{ color: stat.color }}
        >
          {t("item.equip", { effect: stat.label })}
        </p>
      ))}
      {item.description ? (
        <p className="wow-tooltip-flavor">“{item.description}”</p>
      ) : null}
      {item.sellPriceCopper ? (
        <p className="wow-tooltip-sell">
          <span>{t("item.sellPrice")}</span>
          <Money copper={item.sellPriceCopper} />
        </p>
      ) : null}
    </div>
  );
}
