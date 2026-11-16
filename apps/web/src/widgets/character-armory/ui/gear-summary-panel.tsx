import type { EquippedItem } from "@guildhub/contracts";
import {
  Money,
  gearSummary,
  itemQualityColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";

export function GearSummaryPanel({
  items,
}: {
  readonly items: readonly EquippedItem[];
}) {
  const { t, locale } = useLocale();
  const { averageItemLevel, equipped, vendorCopper, durability, breakdown } =
    gearSummary(items);
  return (
    <Reveal className="gear-summary">
      <dl>
        <div>
          <dt>{t("armory.averageItemLevel")}</dt>
          <dd>{formatNumber(averageItemLevel, locale, 1)}</dd>
        </div>
        <div>
          <dt>{t("armory.equipped")}</dt>
          <dd>{equipped}</dd>
        </div>
        <div>
          <dt>{t("armory.vendorTotal")}</dt>
          <dd>
            <Money copper={vendorCopper} />
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
