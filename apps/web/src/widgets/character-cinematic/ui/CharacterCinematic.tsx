import type { CinematicScene } from "@guildhub/contracts";
import {
  compileTimeline,
  decorateFrame,
  type CinematicFrame,
  type CinematicTimeline,
  type FrameDecorator,
} from "../../../shared/cinematic";
import { LoadProgress } from "../../../shared/ui";
import type { PrepareCharacterOptions } from "../../character-model";
import {
  initialUiState,
  mountCinematicStage,
} from "../adapters/mount-cinematic-stage";
import { useEffect, useRef, useState, type CSSProperties } from "react";

/** Files fill the bar to here; compiling the shaders fills the rest. */
const filesShare = 0.9;

type Status = "loading" | "ready" | "error";

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

const applyUiState = (
  element: HTMLElement,
  state: ReturnType<typeof initialUiState>,
): void => {
  element.style.setProperty("--cinematic-opacity", String(state.opacity));
  element.style.setProperty(
    "--cinematic-translate-x",
    `${String(state.translation.x)}px`,
  );
  element.style.setProperty(
    "--cinematic-translate-y",
    `${String(state.translation.y)}px`,
  );
  element.style.setProperty("--cinematic-scale", String(state.scale));
  element.style.setProperty("--cinematic-blur", `${String(state.blur)}px`);
};

const loadScene = async (
  source: string | CinematicScene,
): Promise<CinematicScene> => {
  if (typeof source !== "string") return source;
  const response = await fetch(source);
  if (!response.ok)
    throw new Error(`cinematic scene: HTTP ${String(response.status)}`);
  return (await response.json()) as CinematicScene;
};

export const evaluateMotionFrame = (
  timeline: CinematicTimeline,
  reducedMotion: boolean,
  posterTimeMs?: number,
  previewTimeMs?: number,
): CinematicFrame =>
  reducedMotion || previewTimeMs !== undefined
    ? timeline.poster(previewTimeMs ?? posterTimeMs)
    : timeline.evaluate(timeline.clock.time.elapsedMs);

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
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState(loadingLabel);
  const [progress, setProgress] = useState(0);
  const decoratorsRef = useRef(decorators);
  decoratorsRef.current = decorators;

  useEffect(() => {
    const element = root.current;
    const container = host.current;
    if (!element || !container) return;
    const lifecycle = { disposed: false };
    const isDisposed = () => lifecycle.disposed;
    let frameRequest = 0;
    let previousTimestamp: number | undefined;
    let disposeMounted = (): void => {
      /* filled after the stage mounts */
    };
    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let progressFrame = 0;
    let pendingProgress = 0;
    const showProgress = (fraction: number) => {
      pendingProgress = fraction;
      if (progressFrame !== 0) return;
      progressFrame = requestAnimationFrame(() => {
        progressFrame = 0;
        if (!isDisposed()) setProgress(pendingProgress);
      });
    };

    void loadScene(scene)
      .then(async (sceneData) => {
        if (isDisposed()) return;
        const mounted = await mountCinematicStage({
          container,
          scene: sceneData,
          assetBase,
          manifest,
          transparent: variant === "embedded",
          uiTarget: {
            setState(state) {
              applyUiState(element, state);
            },
          },
          report: (text) => {
            console.warn(text);
          },
          onProgress: (fraction) => {
            showProgress(fraction * filesShare);
          },
        });
        if (isDisposed()) {
          mounted.dispose();
          return;
        }
        disposeMounted = () => {
          mounted.dispose();
        };
        const timeline = compileTimeline(sceneData);
        showProgress(filesShare);
        setMessage(preparingLabel);
        await mounted.rig.prewarm();
        if (isDisposed()) return;
        setStatus("ready");
        setMessage(readyLabel);

        const show = (frame: CinematicFrame) => {
          mounted.director.apply(decorateFrame(frame, decoratorsRef.current));
        };
        if (fitToActorHeight !== undefined) {
          show(timeline.poster(posterTimeMs));
          mounted.rig.fitCameraTo(fitToActorHeight);
        }

        if (reducedMotion || previewTimeMs !== undefined) {
          show(timeline.poster(previewTimeMs ?? posterTimeMs));
          mounted.rig.render();
          return;
        }

        show(timeline.play());
        mounted.rig.render();
        const animate = (timestamp: number) => {
          const delta =
            previousTimestamp === undefined ? 0 : timestamp - previousTimestamp;
          previousTimestamp = timestamp;
          show(timeline.tick(Math.max(0, delta)));
          mounted.rig.render();
          frameRequest = requestAnimationFrame(animate);
        };
        frameRequest = requestAnimationFrame(animate);
      })
      .catch((error: unknown) => {
        if (isDisposed()) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Load failed");
      });

    return () => {
      lifecycle.disposed = true;
      cancelAnimationFrame(frameRequest);
      cancelAnimationFrame(progressFrame);
      disposeMounted();
    };
  }, [
    assetBase,
    fitToActorHeight,
    loadingLabel,
    manifest,
    preparingLabel,
    posterTimeMs,
    previewTimeMs,
    readyLabel,
    scene,
    variant,
  ]);

  const style = {
    "--cinematic-opacity": String(initialUiState().opacity),
    "--cinematic-translate-x": `${String(initialUiState().translation.x)}px`,
    "--cinematic-translate-y": `${String(initialUiState().translation.y)}px`,
    "--cinematic-scale": String(initialUiState().scale),
    "--cinematic-blur": `${String(initialUiState().blur)}px`,
  } as CSSProperties;

  return (
    <section
      ref={root}
      className="cinematic"
      data-state={status}
      data-variant={variant}
      style={style}
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
