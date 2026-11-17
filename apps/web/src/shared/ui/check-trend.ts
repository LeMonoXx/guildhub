import type { TrendPoint } from "./trend-chart";

const shortMoment = (at: string, locale: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));

/** One chart point per recorded check that has a value, labelled with its date and time. */
export function checkTrend<Point extends { readonly at: string }>(
  points: readonly Point[],
  pick: (point: Point) => number | undefined,
  locale: string,
): TrendPoint[] {
  return points.flatMap((point): TrendPoint[] => {
    const value = pick(point);
    return value === undefined
      ? []
      : [{ label: shortMoment(point.at, locale), value }];
  });
}
