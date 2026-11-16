import { describe, expect, test } from "vitest";
import type { FixedLookManifest } from "../model/types";
import {
  assertFixedLookManifest,
  lookAssets,
  resolveAsset,
} from "./look-assets";

const manifest = {
  schemaVersion: 1,
  body: { path: "looks/a/models/100.glb", fileDataId: 100 },
  bodyMetadata: "looks/a/models/100.json",
  items: [],
} as unknown as FixedLookManifest;

describe("resolveAsset", () => {
  test("joins relative paths to the base and keeps absolute ones", () => {
    expect(resolveAsset("/assets", "looks/a.glb")).toBe("/assets/looks/a.glb");
    expect(resolveAsset("/assets/", "/other/a.glb")).toBe("/other/a.glb");
    expect(resolveAsset("/assets", "https://cdn.test/a.glb")).toBe(
      "https://cdn.test/a.glb",
    );
  });
});

describe("lookAssets", () => {
  test("finds item models beside the body and textures in the sibling folder", () => {
    const assets = lookAssets(manifest, "/assets/");
    expect(assets.model(7, "glb")).toBe("/assets/looks/a/models/7.glb");
    expect(assets.texture(7)).toBe("/assets/looks/a/textures/7.png");
  });
});

describe("assertFixedLookManifest", () => {
  test("rejects other schema versions", () => {
    expect(() =>
      assertFixedLookManifest({ ...manifest, schemaVersion: 2 }),
    ).toThrow("unsupported fixed-look manifest");
  });
});
