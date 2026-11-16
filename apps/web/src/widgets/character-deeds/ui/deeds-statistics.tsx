import type { StatisticGroup } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { CountUp, Reveal } from "../../../shared/ui";
import { spotlightGroups, toldGroups } from "../model/statistics";
import { StatGroup } from "./stat-group";

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
