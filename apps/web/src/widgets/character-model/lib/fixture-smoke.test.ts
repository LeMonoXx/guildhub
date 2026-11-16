import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, test } from "vitest";
import type { FixedLookManifest } from "../model/types";

const fixture = (...parts: string[]) =>
  resolve(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "..",
    "test-fixtures",
    "assets",
    ...parts,
  );

describe("authored browser fixture", () => {
  test("the manifest, glTF, metadata, and PNG form a buildable asset set", async () => {
    const current = JSON.parse(
      await readFile(fixture("current.json"), "utf8"),
    ) as { fixedLook: string };
    const manifest = JSON.parse(
      await readFile(fixture(...current.fixedLook.split("/")), "utf8"),
    ) as FixedLookManifest;
    const model = await readFile(fixture(...manifest.body.path.split("/")));
    const parsed = await new GLTFLoader().parseAsync(model.buffer, "");
    const metadata = JSON.parse(
      await readFile(fixture(...manifest.bodyMetadata.split("/")), "utf8"),
    ) as { fileDataId: number };
    const png = await readFile(
      fixture("builds", "authored-fixture", "v1", "textures", "1.png"),
    );

    expect(parsed.scene.getObjectByName("authored_fixture_root")).toBeTruthy();
    expect(metadata.fileDataId).toBe(manifest.body.fileDataId);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
