// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Attachment placement and M2 material selection include logic ported from
// wow.export, Copyright (c) Kruithne and Marlamin, MIT License.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CharacterLook, ModelMeta } from "../types";
import { compositeLook } from "./compositor";
import type { Dressed } from "./dress";
import { m2Material } from "./m2-material";
import { createParticleMesh, type ParticleMesh } from "./particle-mesh";

export interface AssetUrls {
  bodyModel: string;
  bodyMetadata: string;
  animation?: string;
  model: (fileDataId: number, extension: "glb" | "json") => string;
  texture: (fileDataId: number) => string;
}

export interface Character {
  root: THREE.Object3D;
  box: THREE.Box3;
  notices: string[];
  update(delta: number): void;
  dispose(): void;
}

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const fallbackMaterial = new THREE.MeshStandardMaterial({
  color: 0x8899aa,
  roughness: 0.85,
});

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  return (await response.json()) as T;
}

async function loadModel(modelUrl: string, metadataUrl: string) {
  const [response, metadata] = await Promise.all([
    fetch(modelUrl),
    fetchJson<ModelMeta>(metadataUrl),
  ]);
  if (!response.ok)
    throw new Error(`${modelUrl}: HTTP ${String(response.status)}`);
  return {
    gltf: await loader.parseAsync(await response.arrayBuffer(), ""),
    metadata,
  };
}

async function loadGltf(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${String(response.status)}`);
  return loader.parseAsync(await response.arrayBuffer(), "");
}

const meshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const result: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as unknown as { isMesh?: boolean }).isMesh === true)
      result.push(object as THREE.Mesh);
  });
  return result;
};

const dataFor = (
  object: THREE.Object3D,
): { geosetId?: number; submeshIndex?: number } => ({
  ...object.parent?.userData,
  ...object.userData,
});

export async function buildCharacter(
  look: CharacterLook,
  dressed: Dressed,
  assets: AssetUrls,
): Promise<Character> {
  const notices = [...dressed.notes];
  const [body, composited, animation] = await Promise.all([
    loadModel(assets.bodyModel, assets.bodyMetadata),
    compositeLook(
      { textures: look.textures, layers: [...look.layers, ...dressed.layers] },
      assets.texture,
    ),
    assets.animation ? loadGltf(assets.animation) : null,
  ]);
  const textures = new Map<number, THREE.DataTexture>();
  for (const [type, texture] of composited) {
    const map = new THREE.DataTexture(
      texture.pixels,
      texture.width,
      texture.height,
      THREE.RGBAFormat,
    );
    map.flipY = false;
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    textures.set(type, map);
  }

  const root = body.gltf.scene;
  const visible = new Set(dressed.geosets);
  const materials: THREE.Material[] = [];
  const directTextures = new Map<number, THREE.Texture>();
  const particleMeshes: ParticleMesh[] = [];
  const directTexture = async (fileDataId: number) => {
    let texture = directTextures.get(fileDataId);
    if (!texture) {
      texture = await textureLoader.loadAsync(assets.texture(fileDataId));
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      directTextures.set(fileDataId, texture);
    }
    return texture;
  };
  const applyMaterials = async (
    object: THREE.Object3D,
    metadata: ModelMeta,
    replacements: Record<number, number>,
  ): Promise<void> => {
    for (const mesh of meshes(object)) {
      const data = dataFor(mesh);
      const unit = metadata.geosets.find(
        (geoset) => geoset.submeshIndex === data.submeshIndex,
      )?.textureUnits?.[0];
      const reference = unit?.textures[0];
      let texture: THREE.Texture | undefined;
      if (reference !== undefined) {
        texture = textures.get(reference.type);
        const fileDataId = reference.fileDataId ?? replacements[reference.type];
        if (!texture && fileDataId) texture = await directTexture(fileDataId);
      }
      mesh.material = texture
        ? m2Material(texture, unit?.blendMode ?? 0, unit?.materialFlags ?? 0)
        : fallbackMaterial;
      if (mesh.material !== fallbackMaterial) materials.push(mesh.material);
    }
  };
  const applyParticles = async (
    object: THREE.Object3D,
    metadata: ModelMeta,
    replacements: Record<number, number>,
  ) => {
    for (const emitter of metadata.particles ?? []) {
      const reference = metadata.textures.find(
        (texture) => texture.index === emitter.textureIndex,
      );
      const fileDataId =
        emitter.textureFileDataId ??
        reference?.fileDataId ??
        replacements[reference?.type ?? -1];
      const texture = fileDataId ? await directTexture(fileDataId) : null;
      const particle = createParticleMesh(
        emitter,
        texture,
        metadata.fileDataId * 257 + emitter.index,
      );
      const parent = emitter.boneNode
        ? object.getObjectByName(emitter.boneNode)
        : object;
      (parent ?? object).add(particle.object);
      particleMeshes.push(particle);
    }
  };
  await applyMaterials(root, body.metadata, dressed.replaceableTextures);
  await applyParticles(root, body.metadata, dressed.replaceableTextures);
  for (const mesh of meshes(root)) {
    const geosetId = dataFor(mesh).geosetId;
    mesh.visible = geosetId === undefined || visible.has(geosetId);
  }

  for (const attachment of dressed.attachments) {
    const point = root.getObjectByName(
      `attachment_${String(attachment.attachmentId)}`,
    );
    if (!point) {
      notices.push(`body has no attachment ${String(attachment.attachmentId)}`);
      continue;
    }
    try {
      const item = await loadModel(
        assets.model(attachment.modelFileDataId, "glb"),
        assets.model(attachment.modelFileDataId, "json"),
      );
      await applyMaterials(
        item.gltf.scene,
        item.metadata,
        attachment.replaceableTextures,
      );
      await applyParticles(
        item.gltf.scene,
        item.metadata,
        attachment.replaceableTextures,
      );
      point.add(item.gltf.scene);
    } catch {
      notices.push(
        `item model ${String(attachment.modelFileDataId)} is unavailable`,
      );
    }
  }

  const box = new THREE.Box3().setFromObject(root);
  const firstAnimation = animation?.animations[0] ?? body.gltf.animations[0];
  const mixer = firstAnimation ? new THREE.AnimationMixer(root) : null;
  if (mixer && firstAnimation) mixer.clipAction(firstAnimation).play();
  return {
    root,
    box,
    notices,
    update(delta) {
      mixer?.update(delta);
      for (const particle of particleMeshes) particle.update(delta);
    },
    dispose() {
      mixer?.stopAllAction();
      for (const mesh of meshes(root)) mesh.geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures.values()) texture.dispose();
      for (const texture of directTextures.values()) texture.dispose();
      for (const particle of particleMeshes) particle.dispose();
    },
  };
}
