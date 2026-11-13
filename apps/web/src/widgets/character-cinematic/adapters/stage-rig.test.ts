import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import type { CharacterHandle } from "../../character-model";
import { StageRig } from "./stage-rig";

describe("StageRig", () => {
  test("owns its actor and disposes idempotently", () => {
    const canvasRemove = vi.fn();
    const canvas = {
      parentElement: null,
      setAttribute: vi.fn(),
      remove: canvasRemove,
    } as unknown as HTMLCanvasElement;
    const rendererDispose = vi.fn();
    const renderer = {
      domElement: canvas,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      compileAsync: vi.fn(() => Promise.resolve()),
      dispose: rendererDispose,
      outputColorSpace: "",
    } as unknown as THREE.WebGLRenderer;
    const container = {
      clientWidth: 800,
      clientHeight: 450,
      append: vi.fn(),
    } as unknown as HTMLElement;
    const observerDisconnect = vi.fn();
    const observer = { observe: vi.fn(), disconnect: observerDisconnect };
    const actorDispose = vi.fn();
    const actor = {
      root: new THREE.Group(),
      box: new THREE.Box3(),
      faceCamera: vi.fn(),
      dispose: actorDispose,
    } as unknown as CharacterHandle;

    const rig = new StageRig(container, {
      renderer,
      resizeObserver: () => observer,
    });
    rig.setActor(actor);
    rig.render();
    rig.dispose();
    rig.dispose();

    expect(actorDispose).toHaveBeenCalledTimes(1);
    expect(rendererDispose).toHaveBeenCalledTimes(1);
    expect(observerDisconnect).toHaveBeenCalledTimes(1);
    expect(canvasRemove).toHaveBeenCalledTimes(1);
  });
});
