import type { CSSProperties } from "react";

interface LoadProgressProps {
  readonly label: string;
  /** 0 to 1. Without it the bar runs without a known end. */
  readonly fraction?: number | undefined;
  readonly className?: string | undefined;
}

export function LoadProgress({
  label,
  fraction,
  className,
}: LoadProgressProps) {
  const percent =
    fraction === undefined
      ? undefined
      : Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div
      className={className ? `load-progress ${className}` : "load-progress"}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-indeterminate={percent === undefined}
      style={{ "--load-progress": String(percent ?? 0) } as CSSProperties}
    >
      <span className="load-progress-label">
        <span>{label}</span>
        {percent === undefined ? null : (
          <span className="load-progress-value">{percent} %</span>
        )}
      </span>
      <span className="load-progress-track" aria-hidden="true">
        <span className="load-progress-bar" />
      </span>
    </div>
  );
}
