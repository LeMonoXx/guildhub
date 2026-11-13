// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { CharacterModelHandle } from "../model/character-handle";
import { StageSlot } from "../model/stage-slot";

export interface CharacterStage {
  show(character: CharacterModelHandle): void;
  tick(delta: number): void;
  setTime(time: number): void;
  reset(): void;
  dispose(): void;
}

export function createCharacterStage(container: HTMLElement): CharacterStage {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  container.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081722);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2.3));
  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(3, 4, 5);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  const slot = new StageSlot<CharacterModelHandle>();
  let disposed = false;

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const tick = (delta: number) => {
    if (disposed) return;
    slot.visit((character) => {
      character.update(Math.max(delta, 0));
    });
    controls.update();
    slot.visit((character) => {
      character.faceCamera(camera);
    });
    renderer.render(scene, camera);
  };
  return {
    show(character) {
      slot.swap(
        character,
        (next) => {
          scene.add(next.root);
          const size = next.box.getSize(new THREE.Vector3());
          const center = next.box.getCenter(new THREE.Vector3());
          controls.target.copy(center);
          camera.position.set(
            center.x + Math.max(size.y, size.x, 1) * 2.2,
            center.y,
            center.z,
          );
          controls.update();
          tick(0);
        },
        (previous) => {
          scene.remove(previous.root);
        },
      );
    },
    tick,
    setTime(time) {
      slot.visit((character) => {
        character.setTime(time);
        character.faceCamera(camera);
      });
    },
    reset() {
      slot.visit((character) => {
        character.reset();
        character.faceCamera(camera);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      controls.dispose();
      slot.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
