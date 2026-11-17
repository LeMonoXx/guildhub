import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadInstanceConfig } from "./instance.js";

async function writeInstance(body: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "guildhub-instance-"));
  await writeFile(path.join(directory, "instance.json"), body, "utf8");
  return directory;
}

describe("loadInstanceConfig", () => {
  it("loads and validates instance.json", async () => {
    const directory = await writeInstance(
      JSON.stringify({
        slug: "example-guild",
        name: "Example Guild",
        region: "eu",
        guild: { slug: "example-guild" },
      }),
    );

    await expect(loadInstanceConfig(directory)).resolves.toEqual({
      slug: "example-guild",
      name: "Example Guild",
      region: "eu",
      guild: { slug: "example-guild", featured: [] },
    });
  });

  it("fails fast on an invalid instance file", async () => {
    const directory = await writeInstance(
      JSON.stringify({ slug: "Example Guild" }),
    );

    await expect(loadInstanceConfig(directory)).rejects.toThrow(
      "Invalid instance config",
    );
  });
});
