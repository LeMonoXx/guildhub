import { LoadProgress } from "./load-progress";

interface FigureSilhouetteProps {
  /** Shown under the figure's feet with a progress bar. */
  readonly status?: string | undefined;
  readonly fraction?: number | undefined;
  readonly name?: string | undefined;
  readonly className?: string | undefined;
}

/** Stands where a figure will be while its 3D model or portrait is missing. */
export function FigureSilhouette({
  status,
  fraction,
  name,
  className,
}: FigureSilhouetteProps) {
  return (
    <div
      className={
        className ? `figure-silhouette ${className}` : "figure-silhouette"
      }
    >
      <svg
        className="figure-silhouette-shape"
        viewBox="0 0 100 260"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden="true"
      >
        <ellipse cx="50" cy="24" rx="15" ry="18" />
        <path d="M50 46C30 46 18 52 14 66L6 128C5 136 15 138 17 130L26 88L28 150L30 252C30 258 44 258 44 252L48 160H52L56 252C56 258 70 258 70 252L72 150L74 88L83 130C85 138 95 136 94 128L86 66C82 52 70 46 50 46Z" />
      </svg>
      {status === undefined ? null : (
        <div className="figure-silhouette-status">
          {name ? <span className="figure-silhouette-name">{name}</span> : null}
          <LoadProgress label={status} fraction={fraction} />
        </div>
      )}
    </div>
  );
}
