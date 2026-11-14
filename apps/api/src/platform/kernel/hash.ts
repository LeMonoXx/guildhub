import { createHash } from "node:crypto";

export function sha256Hex(value: string, length?: number): string {
  const digest = createHash("sha256").update(value).digest("hex");
  return length === undefined ? digest : digest.slice(0, length);
}
