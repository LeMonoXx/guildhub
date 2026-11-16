import type { TrendPoint } from "./trend-chart";

const shortDay = (day: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    new Date(`${day}T12:00:00Z`),
  );

/** One chart point per recorded day that has a value, labelled with its short date. */
export function dailyTrend<Point extends { readonly day: string }>(
  points: readonly Point[],
  pick: (point: Point) => number | undefined,
  locale: string,
): TrendPoint[] {
  return points.flatMap((point): TrendPoint[] => {
    const value = pick(point);
    return value === undefined
      ? []
      : [{ label: shortDay(point.day, locale), value }];
  });
}
