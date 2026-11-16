import type { CharacterHistoryResponse } from "@guildhub/contracts";
import {
  HistoryChanges,
  HistoryChecked,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { dailyTrend, TrendChart } from "../../../shared/ui";

interface CharacterHistoryProps {
  readonly history: CharacterHistoryResponse;
  readonly classId: string;
}

type Point = CharacterHistoryResponse["series"][number];

export function CharacterHistory({ history, classId }: CharacterHistoryProps) {
  const { t, locale } = useLocale();
  if (history.series.length === 0)
    return <p className="history-empty">{t("history.notStarted")}</p>;
  const series = (pick: (point: Point) => number | undefined) =>
    dailyTrend(history.series, pick, locale);
  const whole = (value: number) => formatNumber(value, locale);
  const itemLevels = series((point) => point.itemLevel);
  return (
    <div className="history">
      <HistoryChecked checkedAt={history.checkedAt} />
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
      <HistoryChanges
        events={history.events}
        recordedDays={history.series.length}
        pageSize={40}
      />
    </div>
  );
}
