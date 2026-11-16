import { useLocale } from "../../../shared/i18n";
import { formatRelativeTime } from "../../../shared/lib";

/** Shows that the hourly recording is alive, even when nothing changed. */
export function HistoryChecked({ checkedAt }: { readonly checkedAt?: string }) {
  const { t, locale } = useLocale();
  if (checkedAt === undefined) return null;
  return (
    <p className="history-since">
      {t("history.checked", { when: formatRelativeTime(checkedAt, locale) })}
    </p>
  );
}
