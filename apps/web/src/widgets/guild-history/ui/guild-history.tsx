import type { GuildHistoryResponse } from "@guildhub/contracts";
import { HistoryFeed } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatDate, formatNumber } from "../../../shared/lib";
import { TrendChart, type TrendPoint } from "../../../shared/ui";

interface GuildHistoryProps {
  readonly history: GuildHistoryResponse;
}

const shortDay = (day: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    new Date(`${day}T12:00:00Z`),
  );

export function GuildHistory({ history }: GuildHistoryProps) {
  const { t, locale } = useLocale();
  if (history.series.length === 0)
    return <p className="history-empty">{t("history.notStarted")}</p>;
  const series = (
    pick: (point: GuildHistoryResponse["series"][number]) => number | undefined,
  ) =>
    history.series.flatMap((point): TrendPoint[] => {
      const value = pick(point);
      return value === undefined
        ? []
        : [{ label: shortDay(point.day, locale), value }];
    });
  const whole = (value: number) => formatNumber(value, locale);
  const tenth = (value: number) => formatNumber(value, locale, 1);
  const itemLevels = series((point) => point.averageItemLevel);
  return (
    <div className="history">
      <p className="history-since">
        {t("history.since", {
          date: formatDate(
            `${history.since ?? history.series[0]?.day ?? ""}T12:00:00Z`,
            locale,
          ),
          days: history.series.length,
          changes: history.events.length,
        })}
      </p>
      <div className="history-charts">
        <TrendChart
          title={t("history.chart.members")}
          points={series((point) => point.members)}
          format={whole}
          color="var(--power-health)"
        />
        <TrendChart
          title={t("history.chart.level")}
          points={series((point) => point.averageLevel)}
          format={tenth}
        />
        {itemLevels.length > 0 ? (
          <TrendChart
            title={t("history.chart.itemLevel")}
            points={itemLevels}
            format={tenth}
            color="var(--quality-epic)"
          />
        ) : null}
        <TrendChart
          title={t("history.chart.memberAchievements")}
          points={series((point) => point.achievements)}
          format={whole}
          color="var(--quality-rare)"
        />
      </div>
      {history.events.length > 0 ? (
        <HistoryFeed events={history.events} />
      ) : (
        <p className="history-empty">{t("history.firstDay")}</p>
      )}
    </div>
  );
}
