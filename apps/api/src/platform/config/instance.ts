import { readFile } from "node:fs/promises";
import path from "node:path";
import { instanceConfigSchema, type InstanceConfig } from "@guildhub/contracts";

export async function loadInstanceConfig(
  instanceDir: string,
): Promise<InstanceConfig> {
  const filePath = path.join(instanceDir, "instance.json");
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    throw new Error(`Instance config not found: ${filePath}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Instance config is not valid JSON: ${filePath}`);
  }

  const parsed = instanceConfigSchema.safeParse(json);
  if (!parsed.success) {
    const keys = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid instance config: ${keys}`);
  }
  return parsed.data;
}
