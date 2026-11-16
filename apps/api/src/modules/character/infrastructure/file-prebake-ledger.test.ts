import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeFilePrebakeLedger } from "./file-prebake-ledger.js";

describe("file prebake ledger", () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "prebake-ledger-"));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("knows nothing before the first write", async () => {
    const ledger = makeFilePrebakeLedger(path.join(directory, "x.json"));
    expect(await ledger.read()).toEqual({});
  });

  it("keeps the race list and the complete build across instances", async () => {
    const file = path.join(directory, "nested", "prebake.json");
    await makeFilePrebakeLedger(file).write({
      races: { build: "1.2.3", ids: [1, 2] },
      completeBuild: "1.2.3",
    });
    expect(await makeFilePrebakeLedger(file).read()).toEqual({
      races: { build: "1.2.3", ids: [1, 2] },
      completeBuild: "1.2.3",
    });
  });

  it("treats a damaged file as unknown", async () => {
    const file = path.join(directory, "prebake.json");
    await writeFile(file, "{not json");
    expect(await makeFilePrebakeLedger(file).read()).toEqual({});
  });
});
