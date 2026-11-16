import type { HistoryEvent } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { HistoryFeed } from "./history-feed";

interface HistoryChangesProps {
  readonly events: readonly HistoryEvent[];
  /** How many days are recorded; the first one is only the baseline. */
  readonly recordedDays: number;
  readonly pageSize?: number;
}

export function HistoryChanges({
  events,
  recordedDays,
  pageSize,
}: HistoryChangesProps) {
  const { t } = useLocale();
  if (events.length > 0)
    return <HistoryFeed events={events} pageSize={pageSize} />;
  if (recordedDays <= 1)
    return <p className="history-empty">{t("history.firstDay")}</p>;
  return <p className="history-empty">{t("history.quiet")}</p>;
}
