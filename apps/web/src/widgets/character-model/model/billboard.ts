// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// Spherical billboard semantics follow WebWowViewerCpp's M2 bone handling.

import * as THREE from "three";

export const SPHERICAL_BILLBOARD = 0x8;

const cameraToBone = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  -Math.PI / 2,
);

export interface BillboardBone {
  bone: THREE.Object3D;
  rest: THREE.Quaternion;
  local: THREE.Quaternion;
}

export function createBillboardBone(bone: THREE.Object3D): BillboardBone {
  return {
    bone,
    rest: bone.quaternion.clone(),
    local: bone.quaternion.clone(),
  };
}

export function restoreBillboard(billboard: BillboardBone): void {
  billboard.bone.quaternion.copy(billboard.rest);
}

export function captureBillboard(billboard: BillboardBone): void {
  billboard.local.copy(billboard.bone.quaternion);
}

export function faceCamera(
  billboard: BillboardBone,
  camera: THREE.Camera,
): void {
  const parentWorld = new THREE.Quaternion();
  const cameraWorld = new THREE.Quaternion();
  billboard.bone.parent?.getWorldQuaternion(parentWorld);
  camera.getWorldQuaternion(cameraWorld);
  billboard.bone.quaternion
    .copy(parentWorld.invert())
    .multiply(cameraWorld)
    .multiply(cameraToBone)
    .multiply(billboard.local);
}
