// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7,
// Copyright (c) 2026 Ryan Williams, MIT License.
// The layer ordering and section placement are ported from wow.export,
// Copyright (c) Kruithne and Marlamin, MIT License.

import type { CharacterLook, TextureLayer } from "../model/types";

export interface CompositedTexture {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export const orderedLayerIds = (layers: TextureLayer[]): number[] =>
  [...layers].sort((a, b) => a.layer - b.layer).map((l) => l.fileDataId);

export async function compositeLook(
  look: Pick<CharacterLook, "textures" | "layers">,
  urlFor: (fileDataId: number) => string,
): Promise<Map<number, CompositedTexture>> {
  const images = new Map<number, ImageBitmap>();
  await Promise.all(
    [...new Set(look.layers.map((layer) => layer.fileDataId))].map(
      async (id) => {
        const response = await fetch(urlFor(id));
        if (!response.ok) return;
        images.set(
          id,
          await createImageBitmap(await response.blob(), {
            premultiplyAlpha: "none",
            colorSpaceConversion: "none",
          }),
        );
      },
    ),
  );

  const result = new Map<number, CompositedTexture>();
  for (const texture of look.textures) {
    const canvas = document.createElement("canvas");
    canvas.width = texture.width;
    canvas.height = texture.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("2D canvas is unavailable");
    context.fillStyle = "#808080";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const layers = look.layers
      .filter((layer) => layer.textureType === texture.textureType)
      .sort((a, b) => a.layer - b.layer);
    for (const layer of layers) {
      const image = images.get(layer.fileDataId);
      if (!image) continue;
      context.globalCompositeOperation =
        layer.blendMode === 4
          ? "multiply"
          : layer.blendMode === 6
            ? "overlay"
            : layer.blendMode === 7
              ? "screen"
              : "source-over";
      const section = layer.section;
      context.drawImage(
        image,
        section.x,
        section.y,
        section.width,
        section.height,
      );
    }
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    result.set(texture.textureType, {
      width: canvas.width,
      height: canvas.height,
      pixels: new Uint8Array(data.data),
    });
  }
  for (const image of images.values()) image.close();
  return result;
}
