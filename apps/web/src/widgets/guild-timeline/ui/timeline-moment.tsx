import { useLocale } from "../../../shared/i18n";
import { formatDateTime, formatRelativeTime } from "../../../shared/lib";

export function TimelineMoment({ at }: { readonly at: string }) {
  const { locale } = useLocale();
  return (
    <time dateTime={at} title={formatDateTime(at, locale)}>
      {formatRelativeTime(at, locale)}
    </time>
  );
}
