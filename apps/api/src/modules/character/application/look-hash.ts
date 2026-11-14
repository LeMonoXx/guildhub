import { sha256Hex } from "../../../platform/kernel/hash.js";
import { canonicalLookKey, type LookDescription } from "../domain/look.js";

export function lookHash(look: LookDescription): string {
  return sha256Hex(canonicalLookKey(look), 16);
}
