import { useId } from "react";
import { useInView } from "../lib/motion";

export interface TrendPoint {
  readonly label: string;
  readonly value: number;
}

interface TrendChartProps {
  readonly title: string;
  readonly points: readonly TrendPoint[];
  readonly format: (value: number) => string;
  /** Any CSS color; the line, the glow and the area take it. */
  readonly color?: string;
}

const WIDTH = 320;
const HEIGHT = 120;
const PAD = 10;

/** A line that draws itself across the recorded days once it scrolls into view. */
export function TrendChart({
  title,
  points,
  format,
  color = "var(--color-gold)",
}: TrendChartProps) {
  const [ref, visible] = useInView<HTMLElement>();
  const gradient = useId();
  const last = points.at(-1);
  const first = points[0];
  if (last === undefined || first === undefined) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = points.length > 1 ? (WIDTH - PAD * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: points.length > 1 ? PAD + index * step : WIDTH / 2,
    y:
      max === min
        ? HEIGHT / 2
        : HEIGHT - PAD - ((point.value - min) / span) * (HEIGHT - PAD * 2),
  }));
  const line = coords
    .map(
      (c, index) =>
        `${index === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`,
    )
    .join(" ");
  const end = coords.at(-1) ?? { x: WIDTH / 2, y: HEIGHT / 2 };
  const start = coords[0] ?? end;
  const area = `${line} L${end.x.toFixed(1)},${String(HEIGHT)} L${start.x.toFixed(1)},${String(HEIGHT)} Z`;
  const delta = last.value - first.value;
  return (
    <figure
      ref={ref}
      className="trend-chart"
      data-visible={visible}
      data-trend={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}
      style={{ ["--trend-color" as string]: color }}
    >
      <figcaption>
        <span className="trend-title">{title}</span>
        <strong className="trend-value">{format(last.value)}</strong>
        {points.length > 1 ? (
          <span className="trend-delta">
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {format(Math.abs(delta))}
          </span>
        ) : null}
      </figcaption>
      <div className="trend-plot">
        <svg
          viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: ${points
            .map((point) => `${point.label} ${format(point.value)}`)
            .join(", ")}`}
        >
          <defs>
            <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--trend-color)"
                stopOpacity="0.35"
              />
              <stop
                offset="100%"
                stopColor="var(--trend-color)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {points.length > 1 ? (
            <>
              <path
                className="trend-area"
                d={area}
                fill={`url(#${gradient})`}
              />
              <path className="trend-line" d={line} />
            </>
          ) : (
            <line
              className="trend-baseline"
              x1={PAD}
              x2={WIDTH - PAD}
              y1={end.y}
              y2={end.y}
            />
          )}
        </svg>
        <span
          className="trend-dot"
          aria-hidden="true"
          style={{
            left: `${String((end.x / WIDTH) * 100)}%`,
            top: `${String((end.y / HEIGHT) * 100)}%`,
          }}
        />
      </div>
      <span className="trend-range" aria-hidden="true">
        <span>{first.label}</span>
        {points.length > 1 ? <span>{last.label}</span> : null}
      </span>
    </figure>
  );
}
