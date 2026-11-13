// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Character } from "./character";

export interface CharacterStage {
  show(character: Character): void;
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
  const clock = new THREE.Clock();
  let current: Character | undefined;

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = container;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  renderer.setAnimationLoop(() => {
    current?.update(clock.getDelta());
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    show(character) {
      if (current) {
        scene.remove(current.root);
        current.dispose();
      }
      current = character;
      scene.add(character.root);
      const size = character.box.getSize(new THREE.Vector3());
      const center = character.box.getCenter(new THREE.Vector3());
      controls.target.copy(center);
      camera.position.set(
        center.x + Math.max(size.y, size.x, 1) * 2.2,
        center.y,
        center.z,
      );
      controls.update();
    },
    dispose() {
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      current?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
