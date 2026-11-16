import type { CinematicScene } from "@guildhub/contracts";
import { useRef, type CSSProperties } from "react";
import type { FrameDecorator } from "../../../shared/cinematic";
import { LoadProgress } from "../../../shared/ui";
import type { PrepareCharacterOptions } from "../../character-model";
import { initialUiState } from "../adapters/mount-cinematic-stage";
import { useCinematicStage } from "../model/use-cinematic-stage";

export interface CharacterCinematicProps {
  readonly scene: string | CinematicScene;
  readonly manifest?: PrepareCharacterOptions["manifest"];
  readonly posterUrl?: string;
  readonly assetBase: string;
  readonly posterTimeMs?: number;
  readonly previewTimeMs?: number;
  readonly ariaLabel?: string;
  readonly variant?: "page" | "embedded";
  readonly loadingLabel?: string;
  /** Shown once the files are in and the GPU prepares the scene. */
  readonly preparingLabel?: string;
  readonly readyLabel?: string;
  /** Live adjustments applied to every frame, in order. */
  readonly decorators?: readonly FrameDecorator[];
  /** Scale the scene's camera to the loaded actor's real crown height. */
  readonly fitToActorHeight?: number;
}

const noDecorators: readonly FrameDecorator[] = [];

const initialStyle = (): CSSProperties => {
  const state = initialUiState();
  return {
    "--cinematic-opacity": String(state.opacity),
    "--cinematic-translate-x": `${String(state.translation.x)}px`,
    "--cinematic-translate-y": `${String(state.translation.y)}px`,
    "--cinematic-scale": String(state.scale),
    "--cinematic-blur": `${String(state.blur)}px`,
  } as CSSProperties;
};

export function CharacterCinematic({
  scene,
  manifest,
  posterUrl,
  assetBase,
  posterTimeMs,
  previewTimeMs,
  ariaLabel = "Animated character introduction",
  variant = "page",
  loadingLabel = "Loading character…",
  preparingLabel = "Preparing…",
  readyLabel = "Character ready",
  decorators = noDecorators,
  fitToActorHeight,
}: CharacterCinematicProps) {
  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const { status, message, progress } = useCinematicStage(root, host, {
    scene,
    manifest,
    assetBase,
    transparent: variant === "embedded",
    posterTimeMs,
    previewTimeMs,
    fitToActorHeight,
    decorators,
    labels: {
      loading: loadingLabel,
      preparing: preparingLabel,
      ready: readyLabel,
    },
  });

  return (
    <section
      ref={root}
      className="cinematic"
      data-state={status}
      data-variant={variant}
      style={initialStyle()}
      aria-busy={status === "loading"}
    >
      <div
        ref={host}
        className="cinematic-stage"
        role="img"
        aria-label={ariaLabel}
      >
        {posterUrl ? (
          <img
            className="cinematic-poster"
            src={posterUrl}
            alt=""
            hidden={status === "ready"}
          />
        ) : null}
        {status === "loading" ? (
          <div className="cinematic-status">
            <LoadProgress label={message} fraction={progress} />
          </div>
        ) : null}
        {status === "error" ? (
          <div className="cinematic-status" role="status">
            {message}
          </div>
        ) : null}
      </div>
      {variant === "page" && (
        <p className={status === "error" ? "notice error" : "notice"}>
          {message}
        </p>
      )}
    </section>
  );
}
