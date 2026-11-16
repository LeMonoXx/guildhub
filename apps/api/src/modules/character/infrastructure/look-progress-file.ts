import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BakeProgress } from "../domain/model.js";

/** A worker that died mid-bake leaves its file behind; this old, it no longer counts. */
const STALE_AFTER_MS = 2 * 60 * 1000;

const progressPath = (root: string, lookHash: string) =>
  path.join(root, "looks", lookHash, "look.progress.json");

/** The worker writes it while baking; the API reads it to show how far a look is. */
export async function writeLookProgress(
  root: string,
  lookHash: string,
  progress: Omit<BakeProgress, "updatedAt">,
): Promise<void> {
  const file = progressPath(root, lookHash);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify({ ...progress, updatedAt: new Date().toISOString() })}\n`,
  );
}

export async function clearLookProgress(
  root: string,
  lookHash: string,
): Promise<void> {
  await rm(progressPath(root, lookHash), { force: true });
}

/**
 * Mirrors a running bake into its progress file. The heartbeat keeps the file
 * fresh through long steps that report nothing, so it never reads as stale.
 */
export function reportLookProgress(
  root: string,
  lookHash: string,
  heartbeatMs = 30_000,
): {
  onStage(stage: BakeProgress["stage"]): void;
  onProgress(fraction: number): void;
  finish(): Promise<void>;
} {
  let latest: Omit<BakeProgress, "updatedAt"> = {
    stage: "opening",
    fraction: 0,
  };
  let finished = false;
  let writing: Promise<void> = Promise.resolve();
  const flush = () => {
    const snapshot = latest;
    writing = writing
      .then(() =>
        finished ? undefined : writeLookProgress(root, lookHash, snapshot),
      )
      .catch(() => undefined);
  };
  flush();
  const heartbeat = setInterval(flush, heartbeatMs);
  heartbeat.unref();
  return {
    onStage: (stage) => {
      latest = { ...latest, stage };
      flush();
    },
    onProgress: (fraction) => {
      latest = { stage: "baking", fraction };
      flush();
    },
    finish: async () => {
      clearInterval(heartbeat);
      finished = true;
      await writing;
      await clearLookProgress(root, lookHash).catch(() => undefined);
    },
  };
}

export async function readLookProgress(
  root: string,
  lookHash: string,
  now: Date = new Date(),
): Promise<BakeProgress | undefined> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(progressPath(root, lookHash), "utf8"));
  } catch {
    return undefined;
  }
  const record = (raw ?? {}) as Record<string, unknown>;
  const stage = record.stage;
  const fraction = record.fraction;
  const updatedAt = new Date(String(record.updatedAt));
  if (
    (stage !== "opening" && stage !== "baking") ||
    typeof fraction !== "number" ||
    Number.isNaN(updatedAt.getTime()) ||
    now.getTime() - updatedAt.getTime() > STALE_AFTER_MS
  )
    return undefined;
  return { stage, fraction: Math.min(1, Math.max(0, fraction)), updatedAt };
}
