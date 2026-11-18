import type { HistoryEvent } from "@guildhub/contracts";
import { useMemo, type ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import type { HistoryEventOf } from "../model/history-event";
import { historyLanes, type TimelineAchievement } from "../model/history-lanes";
import { HistoryLanesView } from "./history-lanes-view";

interface HistoryChangesProps {
  readonly events: readonly HistoryEvent[];
  /** Achievements known with their time beyond the recorded changes. */
  readonly achievements?: readonly TimelineAchievement[];
  /** How many distinct states are recorded; the first one is only the baseline. */
  readonly recordedChecks: number;
  readonly renderCelebration?: (event: HistoryEventOf<"level">) => ReactNode;
}

export function HistoryChanges({
  events,
  achievements,
  recordedChecks,
  renderCelebration,
}: HistoryChangesProps) {
  const { t } = useLocale();
  const lanes = useMemo(
    () => historyLanes(events, achievements),
    [events, achievements],
  );
  if (lanes)
    return (
      <HistoryLanesView lanes={lanes} renderCelebration={renderCelebration} />
    );
  if (recordedChecks <= 1)
    return <p className="history-empty">{t("history.firstCheck")}</p>;
  return <p className="history-empty">{t("history.quiet")}</p>;
}
