const units: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export const formatRelativeTime = (
  iso: string,
  locale: string,
  now: number = Date.now(),
): string => {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return format.format(0, "minute");
};

export const formatNumber = (
  value: number,
  locale: string,
  fractionDigits = 0,
): string =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

export const formatDate = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));

export const formatDateTime = (iso: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

export const daysBetween = (fromIso: string, now: number = Date.now()) =>
  Math.max(0, Math.floor((now - Date.parse(fromIso)) / (24 * 3600 * 1000)));
