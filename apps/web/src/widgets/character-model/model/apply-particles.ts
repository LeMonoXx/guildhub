// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import type * as THREE from "three";
import { optionalTexture, type AssemblyContext } from "./assembly-context";
import { createParticleMesh, type ParticleMesh } from "./particle-mesh";
import type { ModelMeta } from "./types";

type Emitter = NonNullable<ModelMeta["particles"]>[number];

async function emitterTexture(
  emitter: Emitter,
  metadata: ModelMeta,
  replacements: Record<number, number>,
  context: AssemblyContext,
): Promise<THREE.Texture | null> {
  const reference = metadata.textures.find(
    (texture) => texture.index === emitter.textureIndex,
  );
  const fileDataId =
    emitter.textureFileDataId ??
    reference?.fileDataId ??
    replacements[reference?.type ?? -1];
  if (!fileDataId) return null;
  return (await optionalTexture(context, fileDataId)) ?? null;
}

export async function applyParticles(
  object: THREE.Object3D,
  metadata: ModelMeta,
  replacements: Record<number, number>,
  context: AssemblyContext,
  resolveNode: (name: string) => THREE.Object3D | undefined,
): Promise<ParticleMesh[]> {
  const particles: ParticleMesh[] = [];
  try {
    for (const emitter of metadata.particles ?? []) {
      const particle = createParticleMesh(
        emitter,
        await emitterTexture(emitter, metadata, replacements, context),
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
