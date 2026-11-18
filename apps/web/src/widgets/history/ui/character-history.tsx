import type { CharacterHistoryResponse } from "@guildhub/contracts";
import { wowClassColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { checkTrend } from "../../../shared/ui";
import { HistoryDashboard, type HistoryChart } from "./history-dashboard";
import type { RenderCelebration } from "./lane-detail";

interface CharacterHistoryProps {
  readonly history: CharacterHistoryResponse;
  readonly classId: string;
  readonly renderCelebration?: RenderCelebration;
}

type Point = CharacterHistoryResponse["series"][number];

export function CharacterHistory({
  history,
  classId,
  renderCelebration,
}: CharacterHistoryProps) {
  const { t, locale } = useLocale();
  const series = (pick: (point: Point) => number | undefined) =>
    checkTrend(history.series, pick, locale);
  const whole = (value: number) => formatNumber(value, locale);
  const charts: HistoryChart[] = [
    {
      title: t("history.chart.characterLevel"),
      points: series((point) => point.level),
      format: whole,
      color: wowClassColorVar(classId),
    },
    {
      title: t("history.chart.characterItemLevel"),
      points: series((point) => point.itemLevel),
      format: whole,
      color: "var(--quality-epic)",
      optional: true,
    },
    {
      title: t("history.chart.achievements"),
      points: series((point) => point.achievements),
      format: whole,
      color: "var(--quality-rare)",
    },
    {
      title: t("history.chart.characterQuests"),
      points: series((point) => point.quests),
      format: whole,
      color: "var(--quality-uncommon)",
      optional: true,
    },
  ];
  return (
    <HistoryDashboard
      checkedAt={history.checkedAt}
      checks={history.series.length}
      charts={charts}
      events={history.events}
      renderCelebration={renderCelebration}
    />
  );
}
