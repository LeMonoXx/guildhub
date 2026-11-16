// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Attachment placement and M2 material selection include logic ported from
// wow.export, Copyright (c) Kruithne and Marlamin, MIT License.

import * as THREE from "three";
import type { CharacterLook, ModelMeta } from "./types";
import { compositeLook } from "../lib/compositor";
import type { Dressed } from "./dress";
import { AssetStore, type LoadedModel } from "../lib/asset-store";
import {
  createBillboardBone,
  SPHERICAL_BILLBOARD,
  type BillboardBone,
} from "./billboard";
import { CharacterModelHandle } from "./character-handle";
import {
  MaterialAnimationController,
  type MaterialAnimationBinding,
} from "./material-animation";
import { m2Material } from "./materials";
import {
  CharacterRuntime,
  ModelRuntime,
  type ModelAnimationPlan,
} from "./model-runtime";
import type { AnimationGroup } from "./animation-controller";
import { createParticleMesh, type ParticleMesh } from "./particle-mesh";
import { ResourceOwner } from "./resource-owner";

export interface AssetUrls {
  bodyModel: string;
  bodyMetadata: string;
  animations?: readonly { id: number; name: string; url: string }[];
  defaultAnimationId?: number;
  model: (fileDataId: number, extension: "glb" | "json") => string;
  texture: (fileDataId: number) => string;
}

export interface CharacterBuildOptions {
  itemAnimationSpeed?: number;
}

const isMesh = (object: THREE.Object3D): object is THREE.Mesh =>
  "isMesh" in object && object.isMesh === true;

const meshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const result: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (isMesh(object)) result.push(object);
  });
  return result;
};

function ownClonedSkeletons(root: THREE.Object3D, owner: ResourceOwner): void {
  root.traverse((object) => {
    const mesh = object as {
      isSkinnedMesh?: boolean;
      skeleton?: THREE.Skeleton;
    };
    if (mesh.isSkinnedMesh && mesh.skeleton) owner.own(mesh.skeleton);
  });
}

const dataFor = (
  object: THREE.Object3D,
): { geosetId?: number; submeshIndex?: number } => ({
  ...object.parent?.userData,
  ...object.userData,
});

interface AssemblyContext {
  assets: AssetStore;
  owner: ResourceOwner;
  notices: string[];
  textures: Map<number, THREE.DataTexture>;
  runtime: CharacterRuntime;
}

async function applyMaterials(
  object: THREE.Object3D,
  metadata: ModelMeta,
  replacements: Record<number, number>,
  context: InternalAssemblyContext,
): Promise<MaterialAnimationBinding[]> {
  const bindings: MaterialAnimationBinding[] = [];
  for (const mesh of meshes(object)) {
    const data = dataFor(mesh);
    const unit = metadata.geosets.find(
      (geoset) => geoset.submeshIndex === data.submeshIndex,
    )?.textureUnits?.[0];
    const reference = unit?.textures[0];
    if ((unit?.textures.length ?? 0) > 1)
      context.notices.push(
        `model ${String(metadata.fileDataId)} submesh ${String(data.submeshIndex)} uses an unsupported multi-texture combiner; rendering the first texture layer only`,
      );
    for (const layer of unit?.textures.slice(1) ?? []) {
      const animated = (metadata.materialAnimations ?? []).some(
        (track) =>
          (track.kind === "transparency.alpha" &&
            layer.textureWeightIndex === track.targetIndex) ||
          (track.kind.startsWith("textureTransform.") &&
            layer.textureTransformIndex === track.targetIndex),
      );
      if (animated)
        context.notices.push(
          `model ${String(metadata.fileDataId)} submesh ${String(data.submeshIndex)} has an animated non-first texture layer that cannot be represented`,
        );
    }
    let texture: THREE.Texture | undefined;
    if (reference !== undefined) {
      texture = context.textures.get(reference.type);
      const fileDataId = reference.fileDataId ?? replacements[reference.type];
      if (!texture && fileDataId)
        texture = await optionalTexture(context, fileDataId);
    }
    if (!texture) {
      mesh.material = context.fallback;
      continue;
    }
    const animatedTransform = (metadata.materialAnimations ?? []).some(
      (track) =>
        track.kind.startsWith("textureTransform.") &&
        reference?.textureTransformIndex === track.targetIndex,
    );
    if (animatedTransform) {
      texture = context.owner.own(texture.clone());
    }
    const material = context.owner.own(
      m2Material(texture, unit?.blendMode ?? 0, unit?.materialFlags ?? 0),
    );
    mesh.material = material;
    bindings.push({
      material,
      texture,
      colorIndex: unit?.colorIndex,
      textureWeightIndex: reference?.textureWeightIndex,
      textureTransformIndex: reference?.textureTransformIndex,
    });
  }
  return bindings;
}

interface InternalAssemblyContext extends AssemblyContext {
  urls: AssetUrls;
  fallback: THREE.Material;
}

/** The baker skips textures the CDN cannot serve; the mesh keeps the fallback. */
async function optionalTexture(
  context: InternalAssemblyContext,
  fileDataId: number,
): Promise<THREE.Texture | undefined> {
  try {
    return await context.assets.texture(context.urls.texture(fileDataId));
  } catch {
    context.notices.push(`texture ${String(fileDataId)} is unavailable`);
    return undefined;
  }
}

async function applyParticles(
  object: THREE.Object3D,
  metadata: ModelMeta,
  replacements: Record<number, number>,
  context: InternalAssemblyContext,
  resolveNode: (name: string) => THREE.Object3D | undefined,
): Promise<ParticleMesh[]> {
  const particles: ParticleMesh[] = [];
  try {
    for (const emitter of metadata.particles ?? []) {
      const reference = metadata.textures.find(
        (texture) => texture.index === emitter.textureIndex,
      );
      const fileDataId =
        emitter.textureFileDataId ??
        reference?.fileDataId ??
        replacements[reference?.type ?? -1];
      const texture = fileDataId
        ? ((await optionalTexture(context, fileDataId)) ?? null)
        : null;
      const particle = createParticleMesh(
        emitter,
        texture,
        metadata.fileDataId * 257 + emitter.index,
        (message) =>
          context.notices.push(
            `particle emitter ${String(emitter.index)}: ${message}`,
          ),
      );
      const parent = emitter.boneNode ? resolveNode(emitter.boneNode) : object;
      (parent ?? object).add(particle.object);
      particles.push(particle);
    }
  } catch (error) {
    for (const particle of particles) particle.dispose();
    throw error;
  }
  return particles;
}

const clipSeconds = (durationMs: number) => Math.max(durationMs, 1) / 1000;

function animationPlan(
  model: LoadedModel,
  options: {
    groups?: readonly AnimationGroup[];
    defaultGroupId?: number;
    timeScale?: number;
  } = {},
): ModelAnimationPlan {
  const byName = new Map(model.animations.map((clip) => [clip.name, clip]));
  for (const metadata of model.metadata.animations ?? []) {
    const clip = metadata.name ? byName.get(metadata.name) : undefined;
    if (clip) clip.duration = clipSeconds(metadata.durationMs);
  }
  const ordered = [...(model.metadata.animations ?? [])].sort(
    (left, right) =>
      (left.variation ?? 0) - (right.variation ?? 0) ||
      (left.name ?? "").localeCompare(right.name ?? ""),
  );
  const select = (
    predicate: (animation: (typeof ordered)[number]) => boolean,
  ) =>
    ordered
      .filter(predicate)
      .map((metadata) =>
        metadata.name ? byName.get(metadata.name) : undefined,
      )
      .filter((clip): clip is THREE.AnimationClip => clip !== undefined);
  return {
    primary: select(
      (metadata) => metadata.globalSequence === undefined && metadata.id === 0,
    ),
    concurrent: select((metadata) => metadata.globalSequence !== undefined),
    groups: options.groups,
    defaultGroupId: options.defaultGroupId,
    timeScale: options.timeScale,
  };
}

interface MountedModel {
  runtime: ModelRuntime;
  resolveNode(name: string): THREE.Object3D | undefined;
}

async function mountModel(
  model: LoadedModel,
  replacements: Record<number, number>,
  context: InternalAssemblyContext,
  namespace?: string,
  animationOptions?: {
    groups?: readonly AnimationGroup[];
    defaultGroupId?: number;
    timeScale?: number;
  },
): Promise<MountedModel> {
  let resolveNode = (name: string) => model.scene.getObjectByName(name);
  if (namespace) {
    const prefix = `${namespace}__`;
    model.scene.name = namespace;
    model.scene.traverse((object) => {
      if (object !== model.scene) object.name = prefix + object.name;
    });
    for (const clip of model.animations)
      for (const track of clip.tracks) track.name = prefix + track.name;
    resolveNode = (name) => model.scene.getObjectByName(prefix + name);
  }
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
  const billboards: BillboardBone[] = [];
  for (const bone of model.metadata.bones ?? []) {
    if (!(bone.flags & SPHERICAL_BILLBOARD)) continue;
    const object = resolveNode(bone.node);
    if (object) billboards.push(createBillboardBone(object));
  }
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
      billboards,
      materialAnimations,
    ),
  );
  return { runtime, resolveNode };
}

export async function buildCharacter(
  look: CharacterLook,
  dressed: Dressed,
  urls: AssetUrls,
  sharedAssets?: AssetStore,
  options: CharacterBuildOptions = {},
): Promise<CharacterModelHandle> {
  const assets = sharedAssets ?? new AssetStore();
  const ownedAssets = sharedAssets ? undefined : assets;
  const owner = new ResourceOwner();
  const notices = [...dressed.notes];
  const runtime = new CharacterRuntime();
  try {
    const animationAssets = urls.animations ?? [];
    const [body, composited, animationFiles] = await Promise.all([
      assets.model(urls.bodyModel, urls.bodyMetadata),
      compositeLook(
        {
          textures: look.textures,
          layers: [...look.layers, ...dressed.layers],
        },
        urls.texture,
      ),
      Promise.all(
        animationAssets.map(async (animation) => ({
          ...animation,
          clips: await assets.animation(animation.url),
        })),
      ),
    ]);
    const animationGroups: AnimationGroup[] = animationFiles.map(
      ({ id, name, clips }) => ({ id, name, clips }),
    );
    const textures = new Map<number, THREE.DataTexture>();
    for (const [type, texture] of composited) {
      const map = owner.own(
        new THREE.DataTexture(
          texture.pixels,
          texture.width,
          texture.height,
          THREE.RGBAFormat,
        ),
      );
      map.flipY = false;
      map.colorSpace = THREE.SRGBColorSpace;
      map.needsUpdate = true;
      textures.set(type, map);
    }
    const fallback = owner.own(
      new THREE.MeshStandardMaterial({
        color: 0x8899aa,
        roughness: 0.85,
      }),
    );
    const context: InternalAssemblyContext = {
      assets,
      owner,
      notices,
      textures,
      runtime,
      urls,
      fallback,
    };
    await mountModel(
      body,
      dressed.replaceableTextures,
      context,
      undefined,
      animationGroups.length
        ? {
            groups: animationGroups,
            defaultGroupId: urls.defaultAnimationId,
          }
        : undefined,
    );

    const visible = new Set(dressed.geosets);
    for (const mesh of meshes(body.scene)) {
      const geosetId = dataFor(mesh).geosetId;
      mesh.visible = geosetId === undefined || visible.has(geosetId);
    }

    for (const [attachmentIndex, attachment] of dressed.attachments.entries()) {
      const point = body.scene.getObjectByName(
        `attachment_${String(attachment.attachmentId)}`,
      );
      if (!point) {
        notices.push(
          `body has no attachment ${String(attachment.attachmentId)}`,
        );
        continue;
      }
      try {
        const item = await assets.model(
          urls.model(attachment.modelFileDataId, "glb"),
          urls.model(attachment.modelFileDataId, "json"),
        );
        const itemName = `item_${String(attachment.itemId)}_${String(attachment.modelFileDataId)}_${String(attachmentIndex)}`;
        const mountedItem = await mountModel(
          item,
          attachment.replaceableTextures,
          context,
          itemName,
          { timeScale: options.itemAnimationSpeed ?? 0.5 },
        );
        for (const mesh of meshes(item.scene)) mesh.frustumCulled = false;
        for (const [effectIndex, effect] of (
          attachment.effects ?? []
        ).entries()) {
          const effectPoint = mountedItem.resolveNode(
            `attachment_${String(effect.attachmentId)}`,
          );
          if (!effectPoint) continue;
          try {
            const effectModel = await assets.model(
              urls.model(effect.modelFileDataId, "glb"),
              urls.model(effect.modelFileDataId, "json"),
            );
            await mountModel(
              effectModel,
              {},
              context,
              `${itemName}_effect_${String(effectIndex)}`,
              { timeScale: options.itemAnimationSpeed ?? 0.5 },
            );
            for (const mesh of meshes(effectModel.scene))
              mesh.frustumCulled = false;
            effectPoint.add(effectModel.scene);
          } catch {
            notices.push(
              `item ${String(attachment.itemId)} effect model ${String(effect.modelFileDataId)} is unavailable`,
            );
          }
        }
        point.add(item.scene);
      } catch {
        notices.push(
          `item model ${String(attachment.modelFileDataId)} is unavailable`,
        );
      }
    }

    return new CharacterModelHandle(
      body.scene,
      new THREE.Box3().setFromObject(body.scene),
      notices,
      runtime,
      owner,
      ownedAssets,
    );
  } catch (error) {
    runtime.dispose();
    owner.dispose();
    ownedAssets?.dispose();
    throw error;
  }
}

export interface HeldItem {
  readonly object: THREE.Group;
  update(delta: number): void;
  dispose(): void;
}

/** One item's meshes, with the same materials as on the character, and no body. */
export async function buildHeldItem(
  models: readonly { fileDataId: number; textureFileDataId?: number }[],
  urls: Pick<AssetUrls, "model" | "texture">,
): Promise<HeldItem> {
  const assets = new AssetStore();
  const owner = new ResourceOwner();
  const runtime = new CharacterRuntime();
  const group = new THREE.Group();
  const context: InternalAssemblyContext = {
    assets,
    owner,
    notices: [],
    textures: new Map(),
    runtime,
    urls: {
      bodyModel: "",
      bodyMetadata: "",
      model: urls.model,
      texture: urls.texture,
    },
    fallback: owner.own(
      new THREE.MeshStandardMaterial({
        color: 0xc4b49a,
        roughness: 0.55,
        metalness: 0.25,
      }),
    ),
  };
  try {
    for (const [index, model] of models.entries()) {
      const loaded = await assets.model(
        urls.model(model.fileDataId, "glb"),
        urls.model(model.fileDataId, "json"),
      );
      await mountModel(
        loaded,
        model.textureFileDataId === undefined
          ? {}
          : { 2: model.textureFileDataId },
        context,
        `held_${String(index)}`,
        { timeScale: 0.35 },
      );
      group.add(loaded.scene);
    }
  } catch (error) {
    runtime.dispose();
    owner.dispose();
    assets.dispose();
    throw error;
  }
  return {
    object: group,
    update: (delta) => {
      runtime.update(delta);
    },
    dispose: () => {
      runtime.dispose();
      owner.dispose();
      assets.dispose();
    },
  };
}
