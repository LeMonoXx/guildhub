import type { HistoryEvent } from "@guildhub/contracts";
import type { ReactNode } from "react";
import { HistoryChecked } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { TrendChart, type TrendPoint } from "../../../shared/ui";
import { HistoryChanges } from "./history-changes";
import type { RenderCelebration } from "./lane-detail";

export interface HistoryChart {
  readonly title: string;
  readonly points: readonly TrendPoint[];
  readonly format: (value: number) => string;
  readonly color?: string;
  /** A chart without points is left out only when it is optional. */
  readonly optional?: boolean;
}

interface HistoryDashboardProps {
  readonly intro?: ReactNode;
  readonly checkedAt: string | undefined;
  readonly checks: number;
  readonly charts: readonly HistoryChart[];
  readonly events: readonly HistoryEvent[];
  readonly renderCelebration?: RenderCelebration;
}

/** The recorded checks of a guild or a member: when, the trends, the lanes. */
export function HistoryDashboard({
  intro,
  checkedAt,
  checks,
  charts,
  events,
  renderCelebration,
}: HistoryDashboardProps) {
  const { t } = useLocale();
  if (checks === 0)
    return <p className="history-empty">{t("history.notStarted")}</p>;
  return (
    <div className="history">
      {intro}
      <HistoryChecked checkedAt={checkedAt} />
      <div className="history-charts">
        {charts
          .filter((chart) => !chart.optional || chart.points.length > 0)
          .map((chart) => (
            <TrendChart
              key={chart.title}
              title={chart.title}
              points={chart.points}
              format={chart.format}
              color={chart.color}
            />
          ))}
      </div>
      <HistoryChanges
        events={events}
        recordedChecks={checks}
        renderCelebration={renderCelebration}
      />
    </div>
  );
}
