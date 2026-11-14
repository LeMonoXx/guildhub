import type { CharacterHistoryResponse } from "@guildhub/contracts";
import { HistoryFeed, wowClassColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { TrendChart, type TrendPoint } from "../../../shared/ui";

interface CharacterHistoryProps {
  readonly history: CharacterHistoryResponse;
  readonly classId: string;
}

const shortDay = (day: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    new Date(`${day}T12:00:00Z`),
  );

export function CharacterHistory({ history, classId }: CharacterHistoryProps) {
  const { t, locale } = useLocale();
  if (history.series.length === 0)
    return <p className="history-empty">{t("history.notStarted")}</p>;
  const series = (
    pick: (
      point: CharacterHistoryResponse["series"][number],
    ) => number | undefined,
  ) =>
    history.series.flatMap((point): TrendPoint[] => {
      const value = pick(point);
      return value === undefined
        ? []
        : [{ label: shortDay(point.day, locale), value }];
    });
  const whole = (value: number) => formatNumber(value, locale);
  const itemLevels = series((point) => point.itemLevel);
  return (
    <div className="history">
      <div className="history-charts">
        <TrendChart
          title={t("history.chart.characterLevel")}
          points={series((point) => point.level)}
          format={whole}
          color={wowClassColorVar(classId)}
        />
        {itemLevels.length > 0 ? (
          <TrendChart
            title={t("history.chart.characterItemLevel")}
            points={itemLevels}
            format={whole}
            color="var(--quality-epic)"
          />
        ) : null}
        <TrendChart
          title={t("history.chart.achievements")}
          points={series((point) => point.achievements)}
          format={whole}
          color="var(--quality-rare)"
        />
      </div>
      {history.events.length > 0 ? (
        <HistoryFeed events={history.events} pageSize={40} />
      ) : (
        <p className="history-empty">{t("history.firstDay")}</p>
      )}
    </div>
  );
}
