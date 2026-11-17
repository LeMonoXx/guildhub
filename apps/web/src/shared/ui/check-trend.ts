import type { TrendPoint } from "./trend-chart";

const shortDay = (day: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    new Date(`${day}T12:00:00Z`),
  );

const shortMoment = (at: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));

/** One chart point per recorded check that has a value, labelled with its date and time. */
export function checkTrend<
  Point extends { readonly day: string; readonly at?: string },
>(
  points: readonly Point[],
  pick: (point: Point) => number | undefined,
  locale: string,
): TrendPoint[] {
  return points.flatMap((point): TrendPoint[] => {
    const value = pick(point);
    if (value === undefined) return [];
    // Browsers may still hold a response cached before points carried a time.
    const label =
      point.at === undefined
        ? shortDay(point.day, locale)
        : shortMoment(point.at, locale);
    return [{ label, value }];
  });
}
