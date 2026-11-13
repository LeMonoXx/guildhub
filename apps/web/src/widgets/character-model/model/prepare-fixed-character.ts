// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import { loadFixedLook } from "../../../manifest";
import { prepareCharacter } from "./prepare-character";

export async function prepareFixedCharacter() {
  const manifest = await loadFixedLook();
  return prepareCharacter({ manifest, assetBase: "/assets/" });
}
