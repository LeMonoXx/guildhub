import type { ReactNode } from "react";
import { useInView } from "../lib/motion";

interface MeterProps {
  readonly value: number;
  readonly max: number;
  readonly color?: string | undefined;
  readonly label?: ReactNode;
  readonly detail?: ReactNode;
  readonly variant?: "bar" | "frame" | undefined;
  readonly ariaLabel?: string | undefined;
}

/** A progress bar that fills when it scrolls into view. */
export function Meter({
  value,
  max,
  color,
  label,
  detail,
  variant = "bar",
  ariaLabel,
}: MeterProps) {
  const [ref, visible] = useInView<HTMLDivElement>();
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      ref={ref}
      className={`meter meter-${variant}`}
      data-visible={visible}
      style={{
        ["--meter-fill" as string]: String(share),
        ["--meter-color" as string]: color ?? "var(--color-gold)",
      }}
    >
      {label || detail ? (
        <div className="meter-labels">
          <span>{label}</span>
          <span>{detail}</span>
        </div>
      ) : null}
      <div
        className="meter-track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={ariaLabel}
      >
        <div className="meter-fill" />
      </div>
    </div>
  );
}
