import type { StatisticGroup } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { formatDate, formatNumber } from "../../../shared/lib";

export function StatGroup({ group }: { readonly group: StatisticGroup }) {
  const { locale } = useLocale();
  const peak = Math.max(
    1,
    ...group.entries.map((entry) => Math.abs(entry.quantity)),
  );
  return (
    <section className="stat-group">
      <h4>
        {group.name}
        <span>{group.entries.length}</span>
      </h4>
      <ol>
        {group.entries.map((entry, index) => (
          <li
            key={`${entry.name}-${String(index)}`}
            style={{
              ["--share" as string]: String(Math.abs(entry.quantity) / peak),
            }}
          >
            <span className="stat-name">
              {entry.name}
              {entry.detail ? <small>{entry.detail}</small> : null}
            </span>
            <span className="stat-qty">
              {formatNumber(entry.quantity, locale)}
            </span>
            {entry.at ? (
              <time dateTime={entry.at}>{formatDate(entry.at, locale)}</time>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
