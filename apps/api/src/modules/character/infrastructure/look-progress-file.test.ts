import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearLookProgress,
  readLookProgress,
  reportLookProgress,
  writeLookProgress,
} from "./look-progress-file.js";

const roots: string[] = [];

async function root(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "guildhub-progress-"));
  roots.push(directory);
  await mkdir(path.join(directory, "looks", "abc"), { recursive: true });
  return directory;
}

afterEach(async () => {
  for (const directory of roots.splice(0))
    await rm(directory, { recursive: true, force: true });
});

describe("look progress file", () => {
  it("reads back what the worker wrote until it is cleared", async () => {
    const assets = await root();
    await writeLookProgress(assets, "abc", { stage: "baking", fraction: 0.4 });
    expect(await readLookProgress(assets, "abc")).toMatchObject({
      stage: "baking",
      fraction: 0.4,
    });
    await clearLookProgress(assets, "abc");
    expect(await readLookProgress(assets, "abc")).toBeUndefined();
  });

  it("mirrors a bake and removes the file when it ends", async () => {
    const assets = await root();
    const progress = reportLookProgress(assets, "abc");
    progress.onStage("baking");
    progress.onProgress(0.25);
    await vi.waitFor(async () => {
      expect(await readLookProgress(assets, "abc")).toMatchObject({
        stage: "baking",
        fraction: 0.25,
      });
    });
    await progress.finish();
    expect(await readLookProgress(assets, "abc")).toBeUndefined();
  });

  it("ignores a file a dead worker left behind", async () => {
    const assets = await root();
    await writeFile(
      path.join(assets, "looks", "abc", "look.progress.json"),
      JSON.stringify({
        stage: "baking",
        fraction: 0.4,
        updatedAt: "2026-11-16T10:00:00.000Z",
      }),
    );
    expect(
      await readLookProgress(
        assets,
        "abc",
        new Date("2026-11-16T10:05:00.000Z"),
      ),
    ).toBeUndefined();
  });
});
