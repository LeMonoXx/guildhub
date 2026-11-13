import type { CinematicScene, CinematicTrack } from "@guildhub/contracts";
import {
  compileTimeline,
  type CinematicFrame,
  type CinematicTimeline,
} from "../../../cinematic";
import {
  prepareCharacter,
  type PrepareCharacterOptions,
} from "../../character-model";
import {
  AnimationDirector,
  AudioBindingState,
  BindingTargetRegistry,
  createDefaultBindings,
  type UiBindingState,
} from "../adapters/animation-director";
import { SmokeEffect } from "../adapters/smoke-effect";
import { StageRig } from "../adapters/stage-rig";
import { useEffect, useRef, useState, type CSSProperties } from "react";

type Status = "loading" | "ready" | "error";

export interface CharacterCinematicProps {
  readonly scene: string | CinematicScene;
  readonly manifest: PrepareCharacterOptions["manifest"];
  readonly assetBase: string;
  readonly posterTimeMs?: number;
  readonly previewTimeMs?: number;
  readonly ariaLabel?: string;
}

const initialUi: UiBindingState = {
  opacity: 0,
  translation: { x: 0, y: 0, z: 0 },
  scale: 1,
  blur: 0,
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
}: CharacterCinematicProps) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Loading character…");
  const [ui, setUi] = useState<UiBindingState>(initialUi);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const lifecycle = { disposed: false };
    const isDisposed = () => lifecycle.disposed;
    let frameRequest = 0;
    let previousTimestamp: number | undefined;
    const effects: SmokeEffect[] = [];
    const rig = new StageRig(container, { orbitControls: false });
    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    void Promise.allSettled([
      loadScene(scene),
      prepareCharacter({ manifest, assetBase }),
    ])
      .then(async ([sceneResult, characterResult]) => {
        if (sceneResult.status === "rejected") {
          if (characterResult.status === "fulfilled")
            characterResult.value.character.dispose();
          throw sceneResult.reason;
        }
        if (characterResult.status === "rejected") throw characterResult.reason;
        const sceneData = sceneResult.value;
        const prepared = characterResult.value;
        if (isDisposed()) {
          prepared.character.dispose();
          return;
        }
        const timeline = compileTimeline(sceneData);
        const targets = new BindingTargetRegistry();
        const bindings = createDefaultBindings();
        const audio = new AudioBindingState();
        const uiTarget = { setState: setUi };

        rig.setActor(prepared.character);
        const targetInstallers = new Map<
          string,
          (track: CinematicTrack) => void
        >([
          [
            "clip",
            (track) => {
              targets.register(track.kind, track.target, prepared.character);
            },
          ],
          [
            "transform",
            (track) => {
              targets.register(
                track.kind,
                track.target,
                prepared.character.root,
              );
            },
          ],
          [
            "visibility",
            (track) => {
              targets.register(
                track.kind,
                track.target,
                prepared.character.root,
              );
            },
          ],
          [
            "camera",
            (track) => {
              targets.register(track.kind, track.target, rig);
            },
          ],
          [
            "light",
            (track) => {
              const declaration = timeline.scene.declarations.find(
                ({ id }) => id === track.target,
              );
              const lightName =
                declaration?.kind === "asset"
                  ? declaration.asset
                  : track.target;
              const light = rig.lights.get(lightName);
              if (light) targets.register(track.kind, track.target, light);
            },
          ],
          [
            "ui",
            (track) => {
              targets.register(track.kind, track.target, uiTarget);
            },
          ],
          [
            "smoke",
            (track) => {
              const smokeTrack = track as Extract<
                CinematicTrack,
                { kind: "smoke" }
              >;
              const smoke = new SmokeEffect(smokeTrack.seed);
              effects.push(smoke);
              rig.effectRoot.add(smoke.points);
              targets.register(track.kind, track.target, smoke);
            },
          ],
          [
            "audio",
            (track) => {
              targets.register(track.kind, track.target, audio);
            },
          ],
        ]);
        for (const track of timeline.scene.tracks)
          targetInstallers.get(track.kind)?.(track);
        const director = new AnimationDirector(
          bindings,
          targets,
          (diagnostic) => {
            console.warn(`[cinematic] ${diagnostic}`);
          },
        );

        await rig.prewarm();
        if (isDisposed()) return;
        for (const notice of prepared.character.notices)
          console.warn(`[character] ${notice}`);
        setStatus("ready");
        setMessage("Character ready");

        if (reducedMotion || previewTimeMs !== undefined) {
          director.apply(timeline.poster(previewTimeMs ?? posterTimeMs));
          rig.render();
          return;
        }

        director.apply(timeline.play());
        rig.render();
        const animate = (timestamp: number) => {
          const delta =
            previousTimestamp === undefined ? 0 : timestamp - previousTimestamp;
          previousTimestamp = timestamp;
          director.apply(timeline.tick(Math.max(0, delta)));
          rig.render();
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
      for (const effect of effects) effect.dispose();
      rig.dispose();
    };
  }, [assetBase, manifest, posterTimeMs, previewTimeMs, scene]);

  const style = {
    "--cinematic-opacity": String(ui.opacity),
    "--cinematic-translate-x": `${String(ui.translation.x)}px`,
    "--cinematic-translate-y": `${String(ui.translation.y)}px`,
    "--cinematic-scale": String(ui.scale),
    "--cinematic-blur": `${String(ui.blur)}px`,
  } as CSSProperties;

  return (
    <section
      className="cinematic"
      data-state={status}
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
      <p className={status === "error" ? "notice error" : "notice"}>
        {message}
      </p>
    </section>
  );
}
