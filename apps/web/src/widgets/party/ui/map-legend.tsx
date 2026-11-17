import { useLocale } from "../../../shared/i18n";

const LEGEND = ["token", "portal", "zone", "link"] as const;

/** Names each mark on the map once, next to a small copy of it. */
export function MapLegend() {
  const { t } = useLocale();
  return (
    <section className="party-legend" aria-label={t("party.legend.title")}>
      <ul>
        {LEGEND.map((kind) => (
          <li key={kind}>
            <span
              className="party-legend-swatch"
              data-kind={kind}
              aria-hidden="true"
            />
            {t(`party.legend.${kind}`)}
          </li>
        ))}
      </ul>
      <p className="party-legend-controls muted">{t("party.controls")}</p>
    </section>
  );
}
