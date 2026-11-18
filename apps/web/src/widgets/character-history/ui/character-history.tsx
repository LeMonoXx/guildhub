import type { CharacterHistoryResponse } from "@guildhub/contracts";
import type { ReactNode } from "react";
import {
  HistoryChanges,
  HistoryChecked,
  wowClassColorVar,
  type HistoryEventOf,
  type TimelineAchievement,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { checkTrend, TrendChart } from "../../../shared/ui";

interface CharacterHistoryProps {
  readonly history: CharacterHistoryResponse;
  readonly classId: string;
  readonly achievements?: readonly TimelineAchievement[];
  readonly renderCelebration?: (event: HistoryEventOf<"level">) => ReactNode;
}

type Point = CharacterHistoryResponse["series"][number];

export function CharacterHistory({
  history,
  classId,
  achievements,
  renderCelebration,
}: CharacterHistoryProps) {
  const { t, locale } = useLocale();
  if (history.series.length === 0)
    return <p className="history-empty">{t("history.notStarted")}</p>;
  const series = (pick: (point: Point) => number | undefined) =>
    checkTrend(history.series, pick, locale);
  const whole = (value: number) => formatNumber(value, locale);
  const itemLevels = series((point) => point.itemLevel);
  const quests = series((point) => point.quests);
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
        {quests.length > 0 ? (
          <TrendChart
            title={t("history.chart.characterQuests")}
            points={quests}
            format={whole}
            color="var(--quality-uncommon)"
          />
        ) : null}
      </div>
      <HistoryChanges
        events={history.events}
        achievements={achievements}
        recordedChecks={history.series.length}
        renderCelebration={renderCelebration}
        pageSize={40}
      />
    </div>
  );
}
