// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// M2 blend-state mapping is ported from wow.export, Copyright (c) Kruithne
// and Marlamin, MIT License.

import * as THREE from "three";

export function m2Blend(blendMode: number): THREE.MaterialParameters {
  const custom = (
    source: THREE.BlendingSrcFactor,
    destination: THREE.BlendingDstFactor,
    sourceAlpha: THREE.BlendingSrcFactor = source,
    destinationAlpha: THREE.BlendingDstFactor = destination,
  ): THREE.MaterialParameters => ({
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: source,
    blendDst: destination,
    blendSrcAlpha: sourceAlpha,
    blendDstAlpha: destinationAlpha,
    depthWrite: false,
  });
  const blends: Record<number, THREE.MaterialParameters> = {
    0: {},
    1: { alphaTest: 0.501960814 },
    2: custom(
      THREE.SrcAlphaFactor,
      THREE.OneMinusSrcAlphaFactor,
      THREE.OneFactor,
      THREE.OneMinusSrcAlphaFactor,
    ),
    3: custom(
      THREE.OneFactor,
      THREE.OneFactor,
      THREE.ZeroFactor,
      THREE.OneFactor,
    ),
    4: custom(
      THREE.SrcAlphaFactor,
      THREE.OneFactor,
      THREE.ZeroFactor,
      THREE.OneFactor,
    ),
    5: custom(THREE.DstColorFactor, THREE.ZeroFactor),
    6: custom(THREE.DstColorFactor, THREE.SrcColorFactor),
    7: custom(THREE.OneFactor, THREE.OneMinusSrcAlphaFactor),
  };
  return blends[blendMode] ?? { alphaTest: 0.501960814 };
}

export function m2Material(
  map: THREE.Texture,
  blendMode: number,
  flags: number,
): THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  const options: THREE.MeshBasicMaterialParameters = {
    map,
    side: flags & 0x4 ? THREE.DoubleSide : THREE.FrontSide,
    depthTest: (flags & 0x8) === 0,
    ...m2Blend(blendMode),
  };
  if (flags & 0x10) options.depthWrite = false;
  return flags & 0x1
    ? new THREE.MeshBasicMaterial(options)
    : new THREE.MeshStandardMaterial({ ...options, roughness: 0.85 });
}
