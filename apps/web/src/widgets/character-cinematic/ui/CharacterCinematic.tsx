import type { CinematicScene } from "@guildhub/contracts";
import {
  compileTimeline,
  type CinematicFrame,
  type CinematicTimeline,
} from "../../../cinematic";
import type { PrepareCharacterOptions } from "../../character-model";
import {
  initialUiState,
  mountCinematicStage,
} from "../adapters/mount-cinematic-stage";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type Status = "loading" | "ready" | "error";

export interface CharacterCinematicProps {
  readonly scene: string | CinematicScene;
  readonly manifest?: PrepareCharacterOptions["manifest"];
  readonly assetBase: string;
  readonly posterTimeMs?: number;
  readonly previewTimeMs?: number;
  readonly ariaLabel?: string;
  readonly variant?: "page" | "embedded";
  readonly loadingLabel?: string;
  readonly readyLabel?: string;
}

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
  assetBase,
  posterTimeMs,
  previewTimeMs,
  ariaLabel = "Animated character introduction",
  variant = "page",
  loadingLabel = "Loading character…",
  readyLabel = "Character ready",
}: CharacterCinematicProps) {
  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState(loadingLabel);

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

    void loadScene(scene)
      .then(async (sceneData) => {
        if (isDisposed()) return;
        const mounted = await mountCinematicStage({
          container,
          scene: sceneData,
          assetBase,
          manifest,
          uiTarget: {
            setState(state) {
              applyUiState(element, state);
            },
          },
          report: (text) => {
            console.warn(text);
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
        await mounted.rig.prewarm();
        if (isDisposed()) return;
        setStatus("ready");
        setMessage(readyLabel);

        if (reducedMotion || previewTimeMs !== undefined) {
          mounted.director.apply(
            timeline.poster(previewTimeMs ?? posterTimeMs),
          );
          mounted.rig.render();
          return;
        }

        mounted.director.apply(timeline.play());
        mounted.rig.render();
        const animate = (timestamp: number) => {
          const delta =
            previousTimestamp === undefined ? 0 : timestamp - previousTimestamp;
          previousTimestamp = timestamp;
          mounted.director.apply(timeline.tick(Math.max(0, delta)));
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
      disposeMounted();
    };
  }, [
    assetBase,
    loadingLabel,
    manifest,
    posterTimeMs,
    previewTimeMs,
    readyLabel,
    scene,
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
        {status !== "ready" && (
          <div className="cinematic-status" role="status">
            {message}
          </div>
        )}
      </div>
      {variant === "page" && (
        <p className={status === "error" ? "notice error" : "notice"}>
          {message}
        </p>
      )}
    </section>
  );
}
