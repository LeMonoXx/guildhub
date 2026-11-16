import * as THREE from "three";

export function createViewerRenderer(
  canvas: HTMLCanvasElement,
  options: { readonly alpha?: boolean } = {},
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    ...(options.alpha ? { alpha: true } : {}),
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** Keeps the drawing buffer and the camera's aspect at the element's size; returns the stop. */
export function followSize(
  element: HTMLElement,
  renderer: THREE.WebGLRenderer,
  camera: THREE.PerspectiveCamera,
): () => void {
  const fit = () => {
    const width = element.clientWidth || 1;
    const height = element.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(fit);
  observer.observe(element);
  fit();
  return () => {
    observer.disconnect();
  };
}
