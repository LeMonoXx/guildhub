// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.

import { assetUrl, loadFixedLook } from "../manifest";
import { buildCharacter } from "./character";
import { dress } from "./dress";

export async function prepareFixedCharacter() {
  const manifest = await loadFixedLook();
  const modelDirectory = manifest.body.path.replace(/[^/]+$/, "");
  const stand = manifest.animations.find((animation) => animation.id === 0);
  const character = await buildCharacter(
    manifest.look,
    dress(manifest.look, manifest.items),
    {
      bodyModel: assetUrl(manifest.body.path),
      bodyMetadata: assetUrl(manifest.bodyMetadata),
      animation: stand ? assetUrl(stand.path) : undefined,
      model: (id, extension) =>
        assetUrl(`${modelDirectory}${String(id)}.${extension}`),
      texture: (id) =>
        assetUrl(
          `${modelDirectory.replace(/models\/$/, "textures/")}${String(id)}.png`,
        ),
    },
  );
  return { character, manifest };
}
