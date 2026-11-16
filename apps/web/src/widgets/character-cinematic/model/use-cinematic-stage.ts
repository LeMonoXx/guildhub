import type { CinematicScene } from "@guildhub/contracts";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  compileTimeline,
  decorateFrame,
  type FrameDecorator,
} from "../../../shared/cinematic";
import type { PrepareCharacterOptions } from "../../character-model";
import {
  initialUiState,
  mountCinematicStage,
} from "../adapters/mount-cinematic-stage";
import { loadScene } from "../api/load-scene";
import { frameThrottled, startPlayback } from "./cinematic-playback";

/** Files fill the bar to here; compiling the shaders fills the rest. */
const filesShare = 0.9;

export type CinematicStatus = "loading" | "ready" | "error";

export interface CinematicStageOptions {
  readonly scene: string | CinematicScene;
  readonly manifest?: PrepareCharacterOptions["manifest"];
  readonly assetBase: string;
  readonly transparent: boolean;
  readonly posterTimeMs?: number | undefined;
  readonly previewTimeMs?: number | undefined;
  readonly fitToActorHeight?: number | undefined;
  readonly decorators: readonly FrameDecorator[];
  readonly labels: {
    readonly loading: string;
    readonly preparing: string;
    readonly ready: string;
  };
}

export interface CinematicStageState {
  readonly status: CinematicStatus;
  readonly message: string;
  readonly progress: number;
}

export const applyUiState = (
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

/** Loads the scene, mounts the stage into `host` and plays it until unmount. */
export function useCinematicStage(
  root: RefObject<HTMLElement | null>,
  host: RefObject<HTMLDivElement | null>,
  options: CinematicStageOptions,
): CinematicStageState {
  const { labels } = options;
  const [status, setStatus] = useState<CinematicStatus>("loading");
  const [message, setMessage] = useState(labels.loading);
  const [progress, setProgress] = useState(0);
  const decoratorsRef = useRef(options.decorators);
  decoratorsRef.current = options.decorators;

  const {
    scene,
    manifest,
    assetBase,
    transparent,
    posterTimeMs,
    previewTimeMs,
    fitToActorHeight,
  } = options;
  const { preparing, ready } = labels;

  useEffect(() => {
    const element = root.current;
    const container = host.current;
    if (!element || !container) return;
    const lifecycle = { disposed: false };
    const isDisposed = () => lifecycle.disposed;
    let stop = (): void => undefined;
    const progressUpdates = frameThrottled((fraction) => {
      if (!isDisposed()) setProgress(fraction);
    });
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
          transparent,
          uiTarget: {
            setState(state) {
              applyUiState(element, state);
            },
          },
          report: (text) => {
            console.warn(text);
          },
          onProgress: (fraction) => {
            progressUpdates.report(fraction * filesShare);
          },
        });
        if (isDisposed()) {
          mounted.dispose();
          return;
        }
        stop = () => {
          mounted.dispose();
        };
        const timeline = compileTimeline(sceneData);
        progressUpdates.report(filesShare);
        setMessage(preparing);
        await mounted.rig.prewarm();
        if (isDisposed()) return;
        setStatus("ready");
        setMessage(ready);
        const stopPlayback = startPlayback(
          timeline,
          {
            show: (frame) => {
              mounted.director.apply(
                decorateFrame(frame, decoratorsRef.current),
              );
            },
            render: () => {
              mounted.rig.render();
            },
            fitCameraTo: (height) => {
              mounted.rig.fitCameraTo(height);
            },
          },
          { reducedMotion, posterTimeMs, previewTimeMs, fitToActorHeight },
        );
        stop = () => {
          stopPlayback();
          mounted.dispose();
        };
      })
      .catch((error: unknown) => {
        if (isDisposed()) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Load failed");
      });

    return () => {
      lifecycle.disposed = true;
      progressUpdates.cancel();
      stop();
    };
  }, [
    root,
    host,
    assetBase,
    fitToActorHeight,
    manifest,
    preparing,
    posterTimeMs,
    previewTimeMs,
    ready,
    scene,
    transparent,
  ]);

  return { status, message, progress };
}
