import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ModelAssetStore, WorldMapAssets } from "../application/ports.js";
import type { LookBakeDocument } from "../domain/look.js";
import { readLookProgress } from "./look-progress-file.js";

export function makeFilesystemModelAssetStore(
  root: string | undefined,
): ModelAssetStore {
  return {
    currentBuild: async () => {
      if (root === undefined) return undefined;
      try {
        const raw = await readFile(path.join(root, "current.json"), "utf8");
        const parsed = JSON.parse(raw) as { build?: unknown };
        return typeof parsed.build === "string" && parsed.build.length > 0
          ? parsed.build
          : undefined;
      } catch {
        return undefined;
      }
    },
    hasLook: async (lookHash) => {
      if (root === undefined) return false;
      try {
        await access(path.join(root, "looks", lookHash, "look.json"));
        return true;
      } catch {
        return false;
      }
    },
    bakeProgress: async (lookHash) =>
      root === undefined ? undefined : readLookProgress(root, lookHash),
    writeLookRequest: async (job) => {
      if (root === undefined) return;
      const directory = path.join(root, "looks", job.lookHash);
      await mkdir(directory, { recursive: true });
      await writeFile(
        path.join(directory, "look.request.json"),
        `${JSON.stringify(job, null, 2)}\n`,
      );
    },
  };
}

export function makeFilesystemWorldMapAssets(root: string): WorldMapAssets {
  return {
    hasWorldMap: async () => {
      try {
        await access(path.join(root, "maps", "v1", "atlas.json"));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function lookRequestPath(root: string, job: LookBakeDocument): string {
  return path.join(root, "looks", job.lookHash, "look.request.json");
}
