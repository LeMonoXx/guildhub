import type { GuildHistoryResponse } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { daysBetween, formatDate, formatNumber } from "../../../shared/lib";
import { checkTrend } from "../../../shared/ui";
import { HistoryDashboard, type HistoryChart } from "./history-dashboard";
import type { RenderCelebration } from "./lane-detail";

interface GuildHistoryProps {
  readonly history: GuildHistoryResponse;
  readonly renderCelebration?: RenderCelebration;
}

type Point = GuildHistoryResponse["series"][number];

export function GuildHistory({
  history,
  renderCelebration,
}: GuildHistoryProps) {
  const { t, locale } = useLocale();
  const series = (pick: (point: Point) => number | undefined) =>
    checkTrend(history.series, pick, locale);
  const whole = (value: number) => formatNumber(value, locale);
  const tenth = (value: number) => formatNumber(value, locale, 1);
  const charts: HistoryChart[] = [
    {
      title: t("history.chart.members"),
      points: series((point) => point.members),
      format: whole,
      color: "var(--power-health)",
    },
    {
      title: t("history.chart.level"),
      points: series((point) => point.averageLevel),
      format: tenth,
    },
    {
      title: t("history.chart.itemLevel"),
      points: series((point) => point.averageItemLevel),
      format: tenth,
      color: "var(--quality-epic)",
      optional: true,
    },
    {
      title: t("history.chart.memberAchievements"),
      points: series((point) => point.achievements),
      format: whole,
      color: "var(--quality-rare)",
    },
  ];
  const since = history.since ?? history.series[0]?.day ?? "";
  return (
    <HistoryDashboard
      intro={
        <p className="history-since">
          {t("history.since", {
            date: formatDate(`${since}T12:00:00Z`, locale),
            days: daysBetween(`${since}T00:00:00Z`) + 1,
            changes: history.events.length,
          })}
        </p>
      }
      checkedAt={history.checkedAt}
      checks={history.series.length}
      charts={charts}
      events={history.events}
      renderCelebration={renderCelebration}
    />
  );
}
