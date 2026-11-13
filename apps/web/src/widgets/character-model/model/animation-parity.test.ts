import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import type {
  CharacterLook,
  ModelMeta,
  ParticleEmitterMeta,
} from "../../../types";
import { AssetStore, type LoadedModel } from "../lib/asset-store";
import { AnimationController } from "./animation-controller";
import { buildCharacter } from "./assemble-character";
import { createBillboardBone, faceCamera, restoreBillboard } from "./billboard";
import type { Dressed } from "./dress";

const valueClip = (
  name: string,
  duration: number,
  path: string,
  from: number,
  to: number,
) =>
  new THREE.AnimationClip(name, duration, [
    new THREE.NumberKeyframeTrack(path, [0, duration], [from, to]),
  ]);

describe("deterministic animation playback", () => {
  test("sequences every primary clip while globals run concurrently", () => {
    const root = new THREE.Object3D();
    root.userData.primary = 0;
    root.userData.global = 0;
    const controller = new AnimationController(
      root,
      [
        valueClip("first", 1, ".userData[primary]", 0, 1),
        valueClip("second", 2, ".userData[primary]", 10, 20),
      ],
      [valueClip("global", 2, ".userData[global]", 0, 4)],
    );

    expect(controller.clipNames).toEqual(["first", "second"]);
    expect(controller.primaryClipName).toBe("first");
    controller.setTime(1.5);
    expect(controller.primaryClipName).toBe("second");
    expect(root.userData.primary).toBeCloseTo(12.5);
    expect(root.userData.global).toBeCloseTo(3);
    controller.update(1.5);
    expect(controller.primaryClipName).toBe("first");
    controller.reset();
    expect(controller.primaryClipName).toBe("first");
    expect(root.userData.primary).toBeCloseTo(0);
    expect(root.userData.global).toBeCloseTo(0);
    controller.dispose();
  });

  test("crossfades deterministically across ticks and seek cancels the fade", () => {
    const root = new THREE.Object3D();
    root.userData.value = 0;
    const controller = new AnimationController(root, [
      valueClip("first", 2, ".userData[value]", 0, 2),
      valueClip("second", 2, ".userData[value]", 10, 20),
    ]);
    controller.setTime(0.5);
    expect(root.userData.value).toBeCloseTo(0.5);
    expect(controller.crossfade("second", 1)).toBe(true);
    controller.update(0.5);
    expect(root.userData.value).toBeCloseTo(6.75);
    controller.update(0.5);
    expect(root.userData.value).toBeCloseTo(15);

    controller.reset();
    controller.crossfade("second", 1);
    controller.setTime(1);
    expect(root.userData.value).toBeCloseTo(15);
    controller.reset();
    expect(root.userData.value).toBeCloseTo(0);
    controller.dispose();
  });

  test("selects named groups without sequencing across group boundaries", () => {
    const root = new THREE.Object3D();
    root.userData.value = 0;
    const stand = [
      valueClip("StandA", 1, ".userData[value]", 0, 1),
      valueClip("StandB", 1, ".userData[value]", 2, 4),
    ];
    const wave = [valueClip("Wave", 1, ".userData[value]", 10, 20)];
    const controller = new AnimationController(root, [], [], {
      groups: [
        { id: 0, name: "Stand", clips: stand },
        { id: 67, name: "Wave", clips: wave },
      ],
      defaultGroupId: 0,
    });

    expect(controller.groupDescriptors).toEqual([
      { id: 0, name: "Stand" },
      { id: 67, name: "Wave" },
    ]);
    controller.setTime(1.5);
    expect(controller.primaryClipName).toBe("StandB");
    expect(root.userData.value).toBeCloseTo(3);
    expect(controller.selectGroup("Wave")).toBe(true);
    controller.setTime(0.5);
    expect(root.userData.value).toBeCloseTo(15);
    expect(controller.selectGroup(0)).toBe(true);
    expect(controller.primaryClipName).toBe("StandA");
    controller.dispose();
  });

  test("runs concurrent globals when there is no primary clip", () => {
    const root = new THREE.Object3D();
    root.userData.global = 0;
    const controller = new AnimationController(
      root,
      [],
      [valueClip("global", 2, ".userData[global]", 0, 4)],
    );
    controller.setTime(0.5);
    expect(root.userData.global).toBeCloseTo(1);
    controller.reset();
    expect(root.userData.global).toBeCloseTo(0);
    controller.dispose();
  });

  test("combines globals with primary tracks in one mixer", () => {
    const root = new THREE.Object3D();
    root.userData.value = 0;
    const controller = new AnimationController(
      root,
      [valueClip("Stand", 2, ".userData[value]", 0, 2)],
      [valueClip("global", 2, ".userData[value]", 10, 20)],
    );
    controller.setTime(0.5);
    expect(root.userData.value).toBeCloseTo(6.5);
    controller.dispose();
  });

  test("applies configurable animation time scale", () => {
    const root = new THREE.Object3D();
    root.userData.value = 0;
    const controller = new AnimationController(
      root,
      [valueClip("Stand", 1, ".userData[value]", 0, 4)],
      [],
      { timeScale: 0.25 },
    );
    controller.setTime(1);
    expect(root.userData.value).toBeCloseTo(1);
    controller.dispose();
  });

  test("preserves authored glTF duration extras", async () => {
    const source = valueClip("authored", 0.25, ".position[x]", 0, 1);
    const loader = {
      parseAsync: () =>
        Promise.resolve({
          scene: new THREE.Group(),
          scenes: [],
          cameras: [],
          asset: {},
          animations: [source],
          parser: {
            json: { animations: [{ extras: { durationMs: 1750 } }] },
          },
          userData: {},
        }),
    };
    const store = new AssetStore({
      fetch: () =>
        Promise.resolve(
          new Response(new ArrayBuffer(0), {
            status: 200,
          }),
        ),
      gltfLoader: loader as never,
    });
    const clips = await store.animation("authored.glb");
    expect(clips[0]?.duration).toBe(1.75);
    store.dispose();
  });
});

const constant = (...values: number[]) => ({
  durationMs: 1000,
  interpolation: 1,
  keys: [[0, ...values]],
});

const emitter: ParticleEmitterMeta = {
  index: 0,
  flags: 0,
  bone: 0,
  boneNode: null,
  offsetGltf: [0, 0, 0],
  textureIndex: 0,
  textureFileDataId: null,
  blendMode: 4,
  emitterType: 1,
  rows: 1,
  columns: 1,
  tracks: {
    emissionSpeed: constant(0),
    lifespan: constant(2),
    emissionRate: constant(2),
    areaX: constant(0),
    areaY: constant(0),
  },
  lifespanVariation: 0,
  emissionRateVariation: 0,
  scaleVariation: [0, 0],
  drag: 0,
};

const metadata = (
  fileDataId: number,
  animations: NonNullable<ModelMeta["animations"]> = [],
): ModelMeta => ({
  fileDataId,
  textures: [],
  geosets: [{ submeshIndex: 0, geosetId: 1 }],
  animations,
  bones: [],
  particles: [emitter],
});

function model(
  fileDataId: number,
  animations: THREE.AnimationClip[],
  animationMetadata: NonNullable<ModelMeta["animations"]>,
  attachment?: number,
): LoadedModel {
  const scene = new THREE.Group();
  scene.name = `model_${String(fileDataId)}`;
  const animated = new THREE.Object3D();
  animated.name = "animated";
  scene.add(animated);
  if (attachment !== undefined) {
    const point = new THREE.Object3D();
    point.name = `attachment_${String(attachment)}`;
    scene.add(point);
  }
  const mesh = new THREE.Mesh(new THREE.BufferGeometry());
  mesh.name = "mesh";
  mesh.userData.submeshIndex = 0;
  scene.add(mesh);
  return {
    scene,
    animations,
    metadata: metadata(fileDataId, animationMetadata),
  };
}

class SyntheticAssets extends AssetStore {
  readonly skeletonDispose = vi.fn();
  readonly clonedGeometryDispose = vi.fn();

  override model(modelUrl: string): Promise<LoadedModel> {
    if (modelUrl === "body.glb") {
      const loaded = model(1, [], [], 1);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0], 3),
      );
      geometry.setAttribute(
        "skinIndex",
        new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4),
      );
      geometry.setAttribute(
        "skinWeight",
        new THREE.Float32BufferAttribute([1, 0, 0, 0], 4),
      );
      geometry.dispose = this.clonedGeometryDispose;
      const skinned = new THREE.SkinnedMesh(geometry);
      skinned.name = "skinned";
      skinned.userData.submeshIndex = 0;
      const bone = new THREE.Bone();
      skinned.add(bone);
      const skeleton = new THREE.Skeleton([bone]);
      skeleton.dispose = this.skeletonDispose;
      skinned.bind(skeleton);
      loaded.scene.add(skinned);
      return Promise.resolve(loaded);
    }
    if (modelUrl === "2.glb")
      return Promise.resolve(
        model(
          2,
          [
            valueClip("Stand", 1, "animated.position[x]", 0, 2),
            valueClip("Glow", 2, "animated.scale[x]", 1, 3),
          ],
          [
            { name: "Stand", id: 0, variation: 0, durationMs: 1000 },
            { name: "Glow", globalSequence: 0, durationMs: 2000 },
          ],
          2,
        ),
      );
    return Promise.resolve(
      model(
        3,
        [
          valueClip("Stand", 1, "animated.position[y]", 0, 4),
          valueClip("Pulse", 2, "animated.scale[y]", 1, 5),
        ],
        [
          { name: "Stand", id: 0, variation: 0, durationMs: 1000 },
          { name: "Pulse", globalSequence: 0, durationMs: 2000 },
        ],
      ),
    );
  }

  override animation(url: string): Promise<THREE.AnimationClip[]> {
    if (url === "stand.glb")
      return Promise.resolve([
        valueClip("StandA", 1, "animated.position[z]", 0, 1),
        valueClip("StandB", 1, "animated.position[z]", 2, 4),
      ]);
    return Promise.resolve([
      valueClip("Wave", 1, "animated.position[z]", 10, 20),
    ]);
  }
}

describe("mounted item model runtimes", () => {
  test("mounts item effects with materials, particles, Stand, and globals", async () => {
    const assets = new SyntheticAssets();
    const look: CharacterLook = {
      build: "synthetic",
      race: 1,
      sex: 0,
      modelFileDataId: 1,
      textures: [],
      layers: [],
      sections: [],
      sectionLayers: [],
      geosets: [],
    };
    const dressed: Dressed = {
      layers: [],
      geosets: [],
      replaceableTextures: {},
      notes: [],
      attachments: [
        {
          slot: 1,
          itemId: 7,
          attachmentId: 1,
          modelFileDataId: 2,
          replaceableTextures: {},
          effects: [{ attachmentId: 2, modelFileDataId: 3 }],
        },
      ],
    };
    const character = await buildCharacter(
      look,
      dressed,
      {
        bodyModel: "body.glb",
        bodyMetadata: "body.json",
        animations: [
          { id: 0, name: "Stand", url: "stand.glb" },
          { id: 67, name: "Wave", url: "wave.glb" },
        ],
        defaultAnimationId: 0,
        model: (id, extension) => `${String(id)}.${extension}`,
        texture: (id) => `${String(id)}.png`,
      },
      assets,
    );

    expect(character.animationGroups).toEqual([
      { id: 0, name: "Stand" },
      { id: 67, name: "Wave" },
    ]);
    expect(character.selectedAnimationGroup).toEqual({
      id: 0,
      name: "Stand",
    });
    character.setTime(1.5);
    expect(character.root.getObjectByName("animated")?.position.z).toBeCloseTo(
      3,
    );
    expect(character.selectAnimationGroup("Wave")).toBe(true);
    character.setTime(0.5);
    expect(character.root.getObjectByName("animated")?.position.z).toBeCloseTo(
      15,
    );
    expect(character.selectAnimationGroup(0)).toBe(true);

    const item = character.root.getObjectByName("item_7_2_0");
    const effect = character.root.getObjectByName("item_7_2_0_effect_0");
    expect(item).toBeTruthy();
    expect(effect).toBeTruthy();
    expect(item?.getObjectByName("particles_0")).toBeTruthy();
    expect(effect?.getObjectByName("particles_0")).toBeTruthy();
    expect(
      (item?.getObjectByName("item_7_2_0__mesh") as THREE.Mesh).material,
    ).toBeInstanceOf(THREE.Material);

    character.setTime(0.5);
    expect(item?.getObjectByName("item_7_2_0__animated")?.position.x).toBe(0.5);
    expect(item?.getObjectByName("item_7_2_0__animated")?.scale.x).toBe(1.25);
    expect(
      effect?.getObjectByName("item_7_2_0_effect_0__animated")?.position.y,
    ).toBe(1);
    expect(
      effect?.getObjectByName("item_7_2_0_effect_0__animated")?.scale.y,
    ).toBe(1.5);
    expect(
      (item?.getObjectByName("particles_0") as THREE.Points).geometry.drawRange
        .count,
    ).toBe(1);

    character.reset();
    expect(item?.getObjectByName("item_7_2_0__animated")?.position.x).toBe(0);
    character.dispose();
    character.dispose();
    expect(assets.skeletonDispose).toHaveBeenCalledTimes(1);
    expect(assets.clonedGeometryDispose).not.toHaveBeenCalled();
    assets.dispose();
  });
});

describe("spherical billboards", () => {
  test("faces the camera with animated local rotation preserved", () => {
    const parent = new THREE.Object3D();
    parent.rotation.set(0.2, 0.3, 0.1);
    const bone = new THREE.Object3D();
    parent.add(bone);
    parent.updateMatrixWorld(true);
    const billboard = createBillboardBone(bone);
    const local = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.1, 0.4, -0.2),
    );
    bone.quaternion.copy(local);
    billboard.local.copy(bone.quaternion);
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.set(-0.1, 0.7, 0.2);
    camera.updateMatrixWorld(true);

    faceCamera(billboard, camera);
    expect(bone.quaternion.equals(local)).toBe(false);
    restoreBillboard(billboard);
    expect(bone.quaternion.equals(billboard.rest)).toBe(true);
    expect(billboard.local.equals(local)).toBe(true);
  });
});
