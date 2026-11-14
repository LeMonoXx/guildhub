import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeFilesystemModelAssetStore } from "./filesystem-model-asset-store.js";

describe("filesystem model asset store", () => {
  it("reads the current build and look presence from the asset root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "guildhub-assets-"));
    await writeFile(
      path.join(root, "current.json"),
      JSON.stringify({ build: "1.60.1.70938" }),
    );
    await mkdir(path.join(root, "looks", "abc"), { recursive: true });
    await writeFile(path.join(root, "looks", "abc", "look.json"), "{}");
    const store = makeFilesystemModelAssetStore(root);
    await store.writeLookRequest({
      lookHash: "abc",
      clientBuild: "1.60.1.70938",
      race: 1,
      sex: 0,
      classId: 1,
      customizations: [],
      items: [],
      equipmentOverrides: [],
      animationIds: [0],
    });
    await expect(store.currentBuild()).resolves.toBe("1.60.1.70938");
    await expect(store.hasLook("abc")).resolves.toBe(true);
    await expect(store.hasLook("missing")).resolves.toBe(false);
  });

  it("treats a missing asset root as empty", async () => {
    const store = makeFilesystemModelAssetStore(undefined);
    await expect(store.currentBuild()).resolves.toBeUndefined();
    await expect(store.hasLook("abc")).resolves.toBe(false);
    await expect(
      store.writeLookRequest({
        lookHash: "abc",
        clientBuild: "wowf",
        race: 1,
        sex: 0,
        classId: 1,
        customizations: [],
        items: [],
        equipmentOverrides: [],
        animationIds: [],
      }),
    ).resolves.toBeUndefined();
  });
});
