import type {
  CinematicActorDeclaration,
  CinematicScene,
} from "@guildhub/contracts";
import {
  AssetStore,
  prepareCharacter,
  type CharacterHandle,
  type PrepareCharacterOptions,
} from "../../character-model";
import { ActorLoadProgress } from "./actor-load-progress";
import { AnimationDirector } from "./animation-director";
import {
  createDefaultBindings,
  type UiBindingState,
  type UiBindingTarget,
} from "./bindings";
import { StageRig } from "./stage-rig";
import { registerTrackTargets } from "./track-targets";

export interface MountCinematicStageOptions {
  readonly container: HTMLElement;
  readonly scene: CinematicScene;
  readonly assetBase: string;
  readonly manifest?: PrepareCharacterOptions["manifest"];
  readonly uiTarget: UiBindingTarget;
  readonly transparent?: boolean;
  readonly report?: (message: string) => void;
  /** Share of the actors' files loaded, 0 to 1; never decreases. */
  readonly onProgress?: (fraction: number) => void;
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

async function loadActors(
  options: MountCinematicStageOptions,
  rig: StageRig,
  sharedAssets: AssetStore,
): Promise<Map<string, CharacterHandle>> {
  const declarations = actorDeclarations(options.scene);
  const progress = new ActorLoadProgress(
    sharedAssets,
    Math.max(declarations.length, 1),
    options.onProgress,
  );
  const actors = new Map<string, CharacterHandle>();
  try {
    for (const declaration of declarations) {
      progress.startActor();
      const prepared = await prepareCharacter({
        manifest: options.manifest ?? declaration.manifest,
        assetBase: options.assetBase,
        sharedAssets,
      });
      progress.finishActor();
      actors.set(declaration.id, prepared.character);
      rig.addActor(declaration.id, prepared.character);
      for (const notice of prepared.character.notices)
        options.report?.(`[character] ${notice}`);
    }
  } finally {
    progress.dispose();
  }
  return actors;
}

export async function mountCinematicStage(
  options: MountCinematicStageOptions,
): Promise<MountedCinematicStage> {
  const sharedAssets = new AssetStore();
  const rig = new StageRig(options.container, {
    orbitControls: false,
    alpha: options.transparent === true,
  });
  const effects: { dispose(): void }[] = [];
  const dispose = () => {
    for (const effect of effects) effect.dispose();
    rig.dispose();
    sharedAssets.dispose();
  };
  try {
    const actors = await loadActors(options, rig, sharedAssets);
    const targets = registerTrackTargets({
      scene: options.scene,
      actors,
      rig,
      uiTarget: options.uiTarget,
      effects,
    });
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
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

export const initialUiState = (): UiBindingState => ({
  opacity: 0,
  translation: { x: 0, y: 0, z: 0 },
  scale: 1,
  blur: 0,
});
