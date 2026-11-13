import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import type {
  CharacterLook,
  MaterialAnimation,
  ModelMeta,
} from "../../../types";
import { AssetStore, type LoadedModel } from "../lib/asset-store";
import { buildCharacter } from "./assemble-character";
import type { Dressed } from "./dress";
import { MaterialAnimationController } from "./material-animation";
import { sampleTrack } from "./track-sampler";

const track = (
  kind: MaterialAnimation["kind"],
  targetIndex: number,
  keys: number[][],
  over: Partial<MaterialAnimation> = {},
): MaterialAnimation => ({
  kind,
  targetIndex,
  sequenceId: 0,
  durationMs: 1000,
  interpolation: "linear",
  keys,
  ...over,
});

describe("material animation controller", () => {
  test("uses the shared deterministic spline fallback", () => {
    const report = vi.fn();
    expect(
      sampleTrack(
        {
          durationMs: 1000,
          interpolation: "hermite",
          keys: [
            [0, 0],
            [1000, 2],
          ],
        },
        250,
        [],
        { report },
      ),
    ).toEqual([0.5]);
    expect(report).toHaveBeenCalledWith(
      "Unsupported hermite interpolation; using linear fallback",
    );
  });

  test("interpolates RGB, multiplies clamped alpha, and applies UV transforms", () => {
    const texture = new THREE.Texture();
    texture.offset.set(0.1, 0.2);
    texture.repeat.set(2, 3);
    texture.center.set(0.2, 0.3);
    texture.rotation = 0.1;
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.8, 0.6, 0.4),
      map: texture,
      opacity: 0.8,
    });
    const state = () => ({
      color: material.color.toArray(),
      opacity: material.opacity,
      transparent: material.transparent,
      offset: texture.offset.toArray(),
      repeat: texture.repeat.toArray(),
      center: texture.center.toArray(),
      rotation: texture.rotation,
      matrix: texture.matrix.toArray(),
    });
    const base = state();
    const halfTurn = Math.PI / 8;
    const controller = new MaterialAnimationController(
      [
        {
          material,
          texture,
          colorIndex: 2,
          textureWeightIndex: 3,
          textureTransformIndex: 4,
        },
      ],
      [
        track(
          "color.rgb",
          2,
          [
            [0, 1, 0, 0],
            [1000, 0, 1, 1],
          ],
          { globalSequence: 5, sequenceId: null },
        ),
        track("color.alpha", 2, [
          [0, 1],
          [1000, 0.5],
        ]),
        track("transparency.alpha", 3, [
          [0, 0.5],
          [1000, 2.5],
        ]),
        track("textureTransform.translation", 4, [
          [0, 0, 0],
          [1000, 0.4, 0.6],
        ]),
        track("textureTransform.scaling", 4, [
          [0, 1, 1],
          [1000, 2, 3],
        ]),
        track("textureTransform.rotation", 4, [
          [0, 0, 0, 0, 1],
          [500, 0, 0, Math.sin(halfTurn), Math.cos(halfTurn)],
          [1000, 0, 0, Math.SQRT1_2, Math.SQRT1_2],
        ]),
      ],
    );

    controller.setTime(0.5);
    expect(material.color.toArray()).toEqual(
      expect.arrayContaining([
        expect.closeTo(0.4),
        expect.closeTo(0.3),
        expect.closeTo(0.2),
      ]),
    );
    expect(material.opacity).toBeCloseTo(0.6);
    expect(texture.offset.x).toBeCloseTo(0.3);
    expect(texture.offset.y).toBeCloseTo(0.5);
    expect(texture.repeat.toArray()).toEqual([3, 6]);
    expect(texture.center.toArray()).toEqual([0.5, 0.5]);
    expect(texture.rotation).toBeCloseTo(0.1 + Math.PI / 4);

    controller.setTime(0);
    const zero = state();
    expect(zero).not.toEqual(base);
    controller.setTime(0.75);
    controller.reset();
    expect(state()).toEqual(zero);

    controller.dispose();
    expect(state()).toEqual(base);
  });

  test("loops globals, selects sequences, uses item time scale, and resets exactly", () => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.25, 0.5, 0.75),
      opacity: 0.7,
    });
    const controller = new MaterialAnimationController(
      [{ material, colorIndex: 1, textureWeightIndex: 2 }],
      [
        track(
          "color.rgb",
          1,
          [
            [0, 0, 0, 0],
            [1000, 1, 1, 1],
          ],
          { globalSequence: 9, sequenceId: null },
        ),
        track("transparency.alpha", 2, [[0, 0.2]], { sequenceId: 0 }),
        track("transparency.alpha", 2, [[0, 0.9]], {
          sequenceId: 67,
          variation: 1,
        }),
        track("transparency.alpha", 2, [[0, 0.4]], {
          sequenceId: 67,
          variation: 0,
        }),
      ],
      0.5,
    );

    controller.setTime(0.5);
    expect(material.color.toArray()).toEqual(
      expect.arrayContaining([
        expect.closeTo(0.0625),
        expect.closeTo(0.125),
        expect.closeTo(0.1875),
      ]),
    );
    expect(material.opacity).toBeCloseTo(0.14);
    controller.selectSequence(67);
    expect(material.opacity).toBeCloseTo(0.28);
    controller.setTime(2.5);
    expect(material.color.r).toBeCloseTo(0.0625);
    controller.setTime(0);
    const zero = {
      color: material.color.toArray(),
      opacity: material.opacity,
    };
    controller.setTime(0.75);
    controller.reset();
    expect({
      color: material.color.toArray(),
      opacity: material.opacity,
    }).toEqual(zero);
    expect(zero).not.toEqual({
      color: [0.25, 0.5, 0.75],
      opacity: 0.7,
    });
    controller.dispose();
    controller.dispose();
  });
});

class MaterialAssets extends AssetStore {
  readonly shared = new THREE.Texture();

  override model(): Promise<LoadedModel> {
    const scene = new THREE.Group();
    const animated = new THREE.Mesh(new THREE.BufferGeometry());
    animated.userData.submeshIndex = 0;
    animated.name = "animated-material";
    const staticMesh = new THREE.Mesh(new THREE.BufferGeometry());
    staticMesh.userData.submeshIndex = 1;
    staticMesh.name = "static-material";
    scene.add(animated, staticMesh);
    const metadata: ModelMeta = {
      fileDataId: 1,
      textures: [],
      geosets: [
        {
          submeshIndex: 0,
          geosetId: 1,
          textureUnits: [
            {
              colorIndex: 3,
              textures: [
                {
                  textureIndex: 0,
                  type: 0,
                  fileDataId: 10,
                  textureTransformIndex: 7,
                },
              ],
            },
          ],
        },
        {
          submeshIndex: 1,
          geosetId: 2,
          textureUnits: [
            {
              textures: [
                { textureIndex: 0, type: 0, fileDataId: 10 },
                {
                  textureIndex: 1,
                  type: 0,
                  fileDataId: 10,
                  textureTransformIndex: 9,
                },
              ],
            },
          ],
        },
      ],
      animations: [],
      materialAnimations: [
        track("color.rgb", 3, [[0, 1, 0, 0]], { sequenceId: 0 }),
        track("color.rgb", 3, [[0, 0, 1, 0]], { sequenceId: 67 }),
        track(
          "textureTransform.translation",
          7,
          [
            [0, 0.2, 0.3],
            [1000, 1, 1],
          ],
          { globalSequence: 11, sequenceId: null },
        ),
        track("textureTransform.translation", 9, [
          [0, 0, 0],
          [1000, 1, 1],
        ]),
      ],
    };
    return Promise.resolve({ scene, animations: [], metadata });
  }

  override texture(): Promise<THREE.Texture> {
    return Promise.resolve(this.shared);
  }

  override animation(): Promise<THREE.AnimationClip[]> {
    return Promise.resolve([]);
  }
}

describe("assembled animated materials", () => {
  test("clones only animated textures, syncs body sequence, diagnoses, and disposes", async () => {
    const assets = new MaterialAssets();
    const look: CharacterLook = {
      build: "synthetic",
      race: 1,
      sex: 0,
      modelFileDataId: 1,
      textures: [],
      layers: [],
      sections: [],
      sectionLayers: [],
      geosets: [1, 2],
    };
    const dressed: Dressed = {
      layers: [],
      geosets: [1, 2],
      replaceableTextures: {},
      notes: [],
      attachments: [],
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
        model: (id, extension) => `${String(id)}.${extension}`,
        texture: (id) => `${String(id)}.png`,
      },
      assets,
    );
    const animated = character.root.getObjectByName(
      "animated-material",
    ) as THREE.Mesh;
    const staticMesh = character.root.getObjectByName(
      "static-material",
    ) as THREE.Mesh;
    const animatedMaterial = animated.material as THREE.MeshBasicMaterial;
    const staticMaterial = staticMesh.material as THREE.MeshBasicMaterial;
    const animatedMap = animatedMaterial.map;
    if (!animatedMap)
      throw new Error("animated material map was not assembled");
    const dispose = vi.spyOn(animatedMap, "dispose");

    expect(animatedMap).not.toBe(assets.shared);
    expect(staticMaterial.map).toBe(assets.shared);
    character.setTime(0.5);
    expect(animatedMap.offset.x).toBeCloseTo(0.6);
    expect(animatedMap.offset.y).toBeCloseTo(0.65);
    expect(assets.shared.offset.toArray()).toEqual([0, 0]);
    expect(animatedMaterial.color.toArray()).toEqual([1, 0, 0]);
    expect(character.selectAnimationGroup(67, 0.25)).toBe(true);
    expect(animatedMaterial.color.toArray()).toEqual([0, 1, 0]);
    expect(
      character.notices.some((notice) =>
        notice.includes("unsupported multi-texture combiner"),
      ),
    ).toBe(true);
    expect(
      character.notices.some((notice) =>
        notice.includes("animated non-first texture layer"),
      ),
    ).toBe(true);

    character.setTime(0);
    const zero = {
      color: animatedMaterial.color.toArray(),
      offset: animatedMap.offset.toArray(),
    };
    expect(zero.offset).toEqual([0.2, 0.3]);
    expect(zero.offset).not.toEqual(assets.shared.offset.toArray());
    character.setTime(0.5);
    character.reset();
    expect({
      color: animatedMaterial.color.toArray(),
      offset: animatedMap.offset.toArray(),
    }).toEqual(zero);
    character.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(assets.shared.offset.toArray()).toEqual([0, 0]);
    assets.dispose();
  });
});
