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
  switch (blendMode) {
    case 0:
      return {};
    case 1:
      return { alphaTest: 0.501960814 };
    case 2:
      return custom(
        THREE.SrcAlphaFactor,
        THREE.OneMinusSrcAlphaFactor,
        THREE.OneFactor,
        THREE.OneMinusSrcAlphaFactor,
      );
    case 3:
      return custom(
        THREE.OneFactor,
        THREE.OneFactor,
        THREE.ZeroFactor,
        THREE.OneFactor,
      );
    case 4:
      return custom(
        THREE.SrcAlphaFactor,
        THREE.OneFactor,
        THREE.ZeroFactor,
        THREE.OneFactor,
      );
    case 5:
      return custom(THREE.DstColorFactor, THREE.ZeroFactor);
    case 6:
      return custom(THREE.DstColorFactor, THREE.SrcColorFactor);
    case 7:
      return custom(THREE.OneFactor, THREE.OneMinusSrcAlphaFactor);
    default:
      return { alphaTest: 0.501960814 };
  }
}

export function m2Material(
  map: THREE.Texture,
  blendMode: number,
  flags: number,
): THREE.Material {
  const options: THREE.MeshStandardMaterialParameters = {
    map,
    side: flags & 0x4 ? THREE.DoubleSide : THREE.FrontSide,
    depthTest: (flags & 0x8) === 0,
    roughness: 0.85,
    ...m2Blend(blendMode),
  };
  if (flags & 0x10) options.depthWrite = false;
  return flags & 0x1
    ? new THREE.MeshBasicMaterial(options)
    : new THREE.MeshStandardMaterial(options);
}
