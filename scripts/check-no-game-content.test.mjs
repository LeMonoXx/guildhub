import assert from "node:assert/strict";
import test from "node:test";

import { findViolations, violationReason } from "./no-game-content-rules.mjs";

test("rejects Blizzard model and table extensions case-insensitively", () => {
  for (const extension of [
    "gltf",
    "glb",
    "BLP",
    "m2",
    "Skin",
    "anim",
    "DB2",
    "wdc1",
    "WDC4",
  ]) {
    assert.equal(
      violationReason(`fixtures/file.${extension}`),
      "game-content extension",
    );
  }
});

test("rejects CASC and TACT cache, index, and archive paths", () => {
  for (const path of [
    "apps/model-baker/tact-cache/data/a.index",
    "scratch/CASC_INDICES/00abcdef.idx",
    "scratch/tact/archives/archive.data",
    "cache/cdn/archive.index",
    "wow/Data/data/data.000",
    "wow/Data/indices/abcdef.idx",
  ]) {
    assert.equal(violationReason(path), "CASC/TACT cache or archive");
  }
});

test("rejects generated images in model-baker asset paths", () => {
  for (const path of [
    "apps/model-baker/assets/body.png",
    "apps/model-baker/output/textures/face.JPEG",
    "apps/model-baker/cache/icon.webp",
    "apps/model-baker/builds/1.0/model.dds",
  ]) {
    assert.equal(violationReason(path), "generated model-baker image");
  }
});

test("allows only the named authored viewer model fixture", () => {
  assert.equal(
    violationReason(
      "apps/web/test-fixtures/assets/builds/authored-fixture/v1/models/1.gltf",
    ),
    null,
  );
  assert.equal(
    violationReason(
      "apps/web/test-fixtures/assets/builds/authored-fixture/v1/textures/1.png",
    ),
    null,
  );
  assert.equal(
    violationReason(
      "apps/web/test-fixtures/assets/builds/real-build/v3/models/42.gltf",
    ),
    "game-content extension",
  );
  assert.equal(
    violationReason(
      "apps/web/test-fixtures/assets/builds/real-build/v3/textures/42.png",
    ),
    "generated viewer image",
  );
});

test("allows pinned definitions and authored documentation images", () => {
  for (const path of [
    "apps/model-baker/src/GuildHub.ModelBaker/Definitions/ChrModel.dbd",
    "apps/model-baker/src/GuildHub.ModelBaker/Definitions/UPPER.DBD",
    "apps/model-baker/src/GuildHub.ModelBaker/Docs/pipeline.png",
    "apps/web/src/assets/logo.png",
    "docs/architecture/character-rendering.png",
    "docs/casc-format.md",
  ]) {
    assert.equal(violationReason(path), null);
  }
});

test("normalizes Windows paths and reports every violation", () => {
  assert.equal(
    violationReason("APPS\\MODEL-BAKER\\OUTPUT\\BODY.PNG"),
    "generated model-baker image",
  );
  assert.deepEqual(findViolations(["README.md", "assets/body.GLB"]), [
    { path: "assets/body.GLB", reason: "game-content extension" },
  ]);
});
