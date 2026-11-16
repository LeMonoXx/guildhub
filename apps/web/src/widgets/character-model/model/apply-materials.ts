// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// M2 material selection includes logic ported from wow.export,
// Copyright (c) Kruithne and Marlamin, MIT License.

import type * as THREE from "three";
import {
  meshes,
  optionalTexture,
  submeshData,
  type AssemblyContext,
} from "./assembly-context";
import type { MaterialAnimationBinding } from "./material-bindings";
import { m2Material } from "./materials";
import type { ModelMeta } from "./types";

type TextureUnit = NonNullable<
  ModelMeta["geosets"][number]["textureUnits"]
>[number];
type TextureLayer = TextureUnit["textures"][number];
type MaterialTrack = NonNullable<ModelMeta["materialAnimations"]>[number];

const isTransformTrack = (track: MaterialTrack) =>
  track.kind.startsWith("textureTransform.");

function layerIsAnimated(
  layer: TextureLayer,
  tracks: readonly MaterialTrack[],
): boolean {
  return tracks.some(
    (track) =>
      (track.kind === "transparency.alpha" &&
        layer.textureWeightIndex === track.targetIndex) ||
      (isTransformTrack(track) &&
        layer.textureTransformIndex === track.targetIndex),
  );
}

/** Only the first texture layer renders; say so whenever more is lost. */
function reportExtraLayers(
  unit: TextureUnit | undefined,
  metadata: ModelMeta,
  submeshIndex: number | undefined,
  notices: string[],
): void {
  const extra = unit?.textures.slice(1) ?? [];
  if (extra.length === 0) return;
  const where = `model ${String(metadata.fileDataId)} submesh ${String(submeshIndex)}`;
  notices.push(
    `${where} uses an unsupported multi-texture combiner; rendering the first texture layer only`,
  );
  const tracks = metadata.materialAnimations ?? [];
  for (const layer of extra)
    if (layerIsAnimated(layer, tracks))
      notices.push(
        `${where} has an animated non-first texture layer that cannot be represented`,
      );
}

async function layerTexture(
  reference: TextureLayer | undefined,
  replacements: Record<number, number>,
  context: AssemblyContext,
): Promise<THREE.Texture | undefined> {
  if (reference === undefined) return undefined;
  const composited = context.textures.get(reference.type);
  if (composited) return composited;
  const fileDataId = reference.fileDataId ?? replacements[reference.type];
  return fileDataId ? optionalTexture(context, fileDataId) : undefined;
}

/** A texture whose transform animates needs its own copy so siblings stay still. */
function ownTextureFor(
  texture: THREE.Texture,
  reference: TextureLayer | undefined,
  metadata: ModelMeta,
  context: AssemblyContext,
): THREE.Texture {
  const animated = (metadata.materialAnimations ?? []).some(
    (track) =>
      isTransformTrack(track) &&
      reference?.textureTransformIndex === track.targetIndex,
  );
  return animated ? context.owner.own(texture.clone()) : texture;
}

export async function applyMaterials(
  object: THREE.Object3D,
  metadata: ModelMeta,
  replacements: Record<number, number>,
  context: AssemblyContext,
): Promise<MaterialAnimationBinding[]> {
  const bindings: MaterialAnimationBinding[] = [];
  for (const mesh of meshes(object)) {
    const { submeshIndex } = submeshData(mesh);
    const unit = metadata.geosets.find(
      (geoset) => geoset.submeshIndex === submeshIndex,
    )?.textureUnits?.[0];
    const reference = unit?.textures[0];
    reportExtraLayers(unit, metadata, submeshIndex, context.notices);
    const loaded = await layerTexture(reference, replacements, context);
    if (!loaded) {
      mesh.material = context.fallback;
      continue;
    }
    const texture = ownTextureFor(loaded, reference, metadata, context);
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
