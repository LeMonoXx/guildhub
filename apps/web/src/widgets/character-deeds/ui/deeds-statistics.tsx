import type { StatisticGroup } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { formatDate, formatNumber } from "../../../shared/lib";
import { CountUp, Reveal } from "../../../shared/ui";
import { spotlightGroups, toldGroups } from "../model/statistics";

export function DeedsStatistics({
  statisticGroups,
}: {
  readonly statisticGroups: readonly StatisticGroup[];
}) {
  const { t, locale } = useLocale();
  const groups = toldGroups(statisticGroups);
  if (groups.length === 0) return null;
  return (
    <Reveal className="deeds-card deeds-statistics" as="article">
      <h3>{t("deeds.statistics")}</h3>
      <ul className="stat-spotlight">
        {spotlightGroups(groups).map((group) => {
          const lead = group.entries[0];
          if (lead === undefined) return null;
          return (
            <li key={group.id}>
              <span>{group.name}</span>
              <strong>
                <CountUp value={lead.quantity} locale={locale} />
              </strong>
              <em>{lead.name}</em>
            </li>
          );
        })}
      </ul>
      <div className="stat-board">
        {groups.map((group) => (
          <StatGroup key={group.id} group={group} />
        ))}
      </div>
    </Reveal>
  );
}

function StatGroup({ group }: { readonly group: StatisticGroup }) {
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
