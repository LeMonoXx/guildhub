import type { HistoryEvent } from "@guildhub/contracts";
import { useMemo } from "react";
import { useLocale } from "../../../shared/i18n";
import { historyLanes } from "../model/history-lanes";
import { HistoryLanesView } from "./history-lanes-view";
import type { RenderCelebration } from "./lane-detail";

interface HistoryChangesProps {
  readonly events: readonly HistoryEvent[];
  /** How many distinct states are recorded; the first one is only the baseline. */
  readonly recordedChecks: number;
  readonly renderCelebration?: RenderCelebration;
}

export function HistoryChanges({
  events,
  recordedChecks,
  renderCelebration,
}: HistoryChangesProps) {
  const { t } = useLocale();
  const lanes = useMemo(() => historyLanes(events), [events]);
  if (lanes)
    return (
      <HistoryLanesView lanes={lanes} renderCelebration={renderCelebration} />
    );
  if (recordedChecks <= 1)
    return <p className="history-empty">{t("history.firstCheck")}</p>;
  return <p className="history-empty">{t("history.quiet")}</p>;
}
