// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import type * as THREE from "three";
import type { LoadedModel } from "../lib/asset-store";
import { animationPlan, type AnimationOptions } from "./animation-plan";
import { applyMaterials } from "./apply-materials";
import { applyParticles } from "./apply-particles";
import type { AssemblyContext } from "./assembly-context";
import {
  createBillboardBone,
  SPHERICAL_BILLBOARD,
  type BillboardBone,
} from "./billboard";
import { MaterialAnimationController } from "./material-animation";
import { ModelRuntime } from "./model-runtime";
import type { ResourceOwner } from "./resource-owner";

export interface MountedModel {
  runtime: ModelRuntime;
  resolveNode(name: string): THREE.Object3D | undefined;
}

function ownClonedSkeletons(root: THREE.Object3D, owner: ResourceOwner): void {
  root.traverse((object) => {
    const mesh = object as {
      isSkinnedMesh?: boolean;
      skeleton?: THREE.Skeleton;
    };
    if (mesh.isSkinnedMesh && mesh.skeleton) owner.own(mesh.skeleton);
  });
}

/** Several copies of one model share a scene, so their node and track names get a prefix. */
function namespaceNodes(
  model: LoadedModel,
  namespace: string | undefined,
): (name: string) => THREE.Object3D | undefined {
  if (!namespace) return (name) => model.scene.getObjectByName(name);
  const prefix = `${namespace}__`;
  model.scene.name = namespace;
  model.scene.traverse((object) => {
    if (object !== model.scene) object.name = prefix + object.name;
  });
  for (const clip of model.animations)
    for (const track of clip.tracks) track.name = prefix + track.name;
  return (name) => model.scene.getObjectByName(prefix + name);
}

function billboardBones(
  model: LoadedModel,
  resolveNode: (name: string) => THREE.Object3D | undefined,
): BillboardBone[] {
  const billboards: BillboardBone[] = [];
  for (const bone of model.metadata.bones ?? []) {
    if (!(bone.flags & SPHERICAL_BILLBOARD)) continue;
    const object = resolveNode(bone.node);
    if (object) billboards.push(createBillboardBone(object));
  }
  return billboards;
}

/** Dresses one loaded model and registers its animation runtime. */
export async function mountModel(
  model: LoadedModel,
  replacements: Record<number, number>,
  context: AssemblyContext,
  namespace?: string,
  animationOptions?: AnimationOptions,
): Promise<MountedModel> {
  const resolveNode = namespaceNodes(model, namespace);
  ownClonedSkeletons(model.scene, context.owner);
  const materialBindings = await applyMaterials(
    model.scene,
    model.metadata,
    replacements,
    context,
  );
  const particles = await applyParticles(
    model.scene,
    model.metadata,
    replacements,
    context,
    resolveNode,
  );
  const materialAnimations = new MaterialAnimationController(
    materialBindings,
    model.metadata.materialAnimations ?? [],
    animationOptions?.timeScale ?? 1,
    animationOptions?.defaultGroupId ?? 0,
    undefined,
    (message) =>
      context.notices.push(
        `model ${String(model.metadata.fileDataId)} material animation: ${message}`,
      ),
  );
  const runtime = context.runtime.add(
    new ModelRuntime(
      model.scene,
      animationPlan(model, animationOptions),
      particles,
      billboardBones(model, resolveNode),
      materialAnimations,
    ),
  );
  return { runtime, resolveNode };
}
