import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import { AssetStore } from "../lib/asset-store";
import { AnimationController } from "./animation-controller";
import { EmitterStrategyRegistry } from "./emitter-strategies";
import { ResourceOwner } from "./resource-owner";
import { StageSlot } from "./stage-slot";

describe("AssetStore", () => {
  test("deduplicates in-flight URL requests", async () => {
    const store = new AssetStore();
    let resolve!: (value: string) => void;
    const pending = new Promise<string>((done) => {
      resolve = done;
    });
    const load = vi.fn(() => pending);

    const first = store.loadOnce("model.glb", load);
    const second = store.loadOnce("model.glb", load);
    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);
    resolve("loaded");
    await expect(Promise.all([first, second])).resolves.toEqual([
      "loaded",
      "loaded",
    ]);
    store.dispose();
  });

  test("rejects work after its explicit scope is disposed", async () => {
    const store = new AssetStore();
    store.dispose();
    await expect(
      store.loadOnce("late.glb", () => Promise.resolve("loaded")),
    ).rejects.toThrow("disposed AssetStore");
  });
});

describe("AnimationController", () => {
  test("plays, seeks, resets, crossfades, and disposes multiple clips", () => {
    const root = new THREE.Object3D();
    root.userData.value = 0;
    const track = (name: string, end: number) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.NumberKeyframeTrack(".userData[value]", [0, 1], [0, end]),
      ]);
    const controller = new AnimationController(root, [
      track("idle", 1),
      track("wave", 2),
    ]);

    expect(controller.clipNames).toEqual(["idle", "wave"]);
    expect(controller.play("wave")).toBe(true);
    controller.setTime(0.5);
    expect(root.userData.value).toBeCloseTo(1);
    expect(controller.crossfade("idle", 0.2)).toBe(true);
    controller.reset();
    expect(root.userData.value).toBeCloseTo(0);
    expect(controller.play("missing")).toBe(false);
    controller.dispose();
    controller.dispose();
  });
});

describe("EmitterStrategyRegistry", () => {
  test("dispatches registered strategies and explicitly diagnoses fallback", () => {
    const registry = new EmitterStrategyRegistry().register(9, () => ({
      position: [9, 0, 0],
      direction: [0, 1, 0],
    }));
    expect(registry.resolve(9)({} as never).position).toEqual([9, 0, 0]);
    const report = vi.fn();
    expect(registry.resolve(404, report)({} as never).position).toEqual([
      0, 0, 0,
    ]);
    expect(report).toHaveBeenCalledWith(
      "Unsupported particle emitter type 404; using point fallback",
    );
  });
});

describe("ownership and stage lifecycle", () => {
  test("disposes each unique resource exactly once", () => {
    const owner = new ResourceOwner();
    const resource = { dispose: vi.fn() };
    owner.own(resource);
    owner.own(resource);
    owner.dispose();
    owner.dispose();
    expect(resource.dispose).toHaveBeenCalledTimes(1);
  });

  test("disposes the old character on swap and the current one on teardown", () => {
    const slot = new StageSlot<{ dispose(): void; name: string }>();
    const first = { name: "first", dispose: vi.fn() };
    const second = { name: "second", dispose: vi.fn() };
    const attached: string[] = [];
    const detached: string[] = [];
    slot.swap(
      first,
      (value) => attached.push(value.name),
      (value) => detached.push(value.name),
    );
    slot.swap(
      second,
      (value) => attached.push(value.name),
      (value) => detached.push(value.name),
    );
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(attached).toEqual(["first", "second"]);
    expect(detached).toEqual(["first"]);
    slot.dispose();
    slot.dispose();
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });
});
