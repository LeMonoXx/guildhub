import type { HistoryEvent } from "@guildhub/contracts";
import type { ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import type { HistoryEventOf } from "../model/history-event";
import {
  historyTimeline,
  type TimelineAchievement,
} from "../model/history-timeline";
import { HistoryTimeline } from "./history-timeline";

interface HistoryChangesProps {
  readonly events: readonly HistoryEvent[];
  /** Achievements known with their time beyond the recorded changes. */
  readonly achievements?: readonly TimelineAchievement[];
  /** How many distinct states are recorded; the first one is only the baseline. */
  readonly recordedChecks: number;
  readonly renderCelebration?: (event: HistoryEventOf<"level">) => ReactNode;
  readonly pageSize?: number;
}

export function HistoryChanges({
  events,
  achievements,
  recordedChecks,
  renderCelebration,
  pageSize,
}: HistoryChangesProps) {
  const { t } = useLocale();
  const days = historyTimeline(events, achievements);
  if (days.length > 0)
    return (
      <HistoryTimeline
        days={days}
        renderCelebration={renderCelebration}
        pageSize={pageSize}
      />
    );
  if (recordedChecks <= 1)
    return <p className="history-empty">{t("history.firstCheck")}</p>;
  return <p className="history-empty">{t("history.quiet")}</p>;
}
