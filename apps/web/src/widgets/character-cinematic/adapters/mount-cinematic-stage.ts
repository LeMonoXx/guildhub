import type {
  CinematicActorDeclaration,
  CinematicScene,
  CinematicTrack,
} from "@guildhub/contracts";
import {
  AssetStore,
  prepareCharacter,
  type CharacterHandle,
  type PrepareCharacterOptions,
} from "../../character-model";
import {
  AnimationDirector,
  AudioBindingState,
  BindingTargetRegistry,
  createDefaultBindings,
  type UiBindingState,
  type UiBindingTarget,
} from "./animation-director";
import { SmokeEffect } from "./smoke-effect";
import { StageRig } from "./stage-rig";
import { TeleportEffect } from "./teleport-effect";

const hashTrackId = (id: string): number => {
  let hash = 0x811c9dc5;
  for (const char of id)
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return hash;
};

export interface MountCinematicStageOptions {
  readonly container: HTMLElement;
  readonly scene: CinematicScene;
  readonly assetBase: string;
  readonly manifest?: PrepareCharacterOptions["manifest"];
  readonly uiTarget: UiBindingTarget;
  readonly transparent?: boolean;
  readonly report?: (message: string) => void;
}

export interface MountedCinematicStage {
  readonly rig: StageRig;
  readonly director: AnimationDirector;
  readonly actorIds: readonly string[];
  readonly sharedAssets: AssetStore;
  dispose(): void;
}

export const actorDeclarations = (
  scene: CinematicScene,
): readonly CinematicActorDeclaration[] =>
  scene.declarations.filter(
    (declaration): declaration is CinematicActorDeclaration =>
      declaration.kind === "actor",
  );

export async function mountCinematicStage(
  options: MountCinematicStageOptions,
): Promise<MountedCinematicStage> {
  const sharedAssets = new AssetStore();
  const rig = new StageRig(options.container, {
    orbitControls: false,
    alpha: options.transparent === true,
  });
  const effects: { dispose(): void }[] = [];
  const actors = new Map<string, CharacterHandle>();
  try {
    const declarations = actorDeclarations(options.scene);
    for (const declaration of declarations) {
      const prepared = await prepareCharacter({
        manifest: options.manifest ?? declaration.manifest,
        assetBase: options.assetBase,
        sharedAssets,
      });
      actors.set(declaration.id, prepared.character);
      rig.addActor(declaration.id, prepared.character);
      for (const notice of prepared.character.notices)
        options.report?.(`[character] ${notice}`);
    }

    const targets = new BindingTargetRegistry();
    const installers = new Map<string, (track: CinematicTrack) => void>([
      [
        "clip",
        (track) => {
          const actor = actors.get(track.target);
          if (actor) targets.register(track.kind, track.target, actor);
        },
      ],
      [
        "transform",
        (track) => {
          const actor = actors.get(track.target);
          if (actor) targets.register(track.kind, track.target, actor.root);
        },
      ],
      [
        "visibility",
        (track) => {
          const actor = actors.get(track.target);
          if (actor) targets.register(track.kind, track.target, actor.root);
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
          const declaration = options.scene.declarations.find(
            ({ id }) => id === track.target,
          );
          const lightName =
            declaration?.kind === "asset" ? declaration.asset : track.target;
          const light = rig.lights.get(lightName);
          if (light) targets.register(track.kind, track.target, light);
        },
      ],
      [
        "ui",
        (track) => {
          targets.register(track.kind, track.target, options.uiTarget);
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
        "teleport",
        (track) => {
          const teleport = new TeleportEffect(hashTrackId(track.id));
          effects.push(teleport);
          rig.effectRoot.add(teleport.root);
          targets.register(track.kind, track.target, teleport);
        },
      ],
      [
        "audio",
        (track) => {
          targets.register(track.kind, track.target, new AudioBindingState());
        },
      ],
    ]);
    for (const track of options.scene.tracks)
      installers.get(track.kind)?.(track);

    return {
      rig,
      director: new AnimationDirector(
        createDefaultBindings(),
        targets,
        (diagnostic) => {
          options.report?.(`[cinematic] ${diagnostic}`);
        },
      ),
      actorIds: [...actors.keys()],
      sharedAssets,
      dispose() {
        for (const effect of effects) effect.dispose();
        rig.dispose();
        sharedAssets.dispose();
      },
    };
  } catch (error) {
    for (const effect of effects) effect.dispose();
    rig.dispose();
    sharedAssets.dispose();
    throw error;
  }
}

export const initialUiState = (): UiBindingState => ({
  opacity: 0,
  translation: { x: 0, y: 0, z: 0 },
  scale: 1,
  blur: 0,
});
