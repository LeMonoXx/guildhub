/** Opaque area of a transparent render, as shares of the image (0 to 1). */
export interface FigureBounds {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

const sampleWidth = 160;
const opaqueAlpha = 32;

/** Undefined when the image cannot be read back or is fully transparent. */
export function measureFigureBounds(
  image: HTMLImageElement,
): FigureBounds | undefined {
  if (image.naturalWidth === 0 || image.naturalHeight === 0) return undefined;
  const width = sampleWidth;
  const height = Math.max(
    1,
    Math.round((sampleWidth * image.naturalHeight) / image.naturalWidth),
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(image, 0, 0, width, height);
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return undefined;
  }
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) < opaqueAlpha) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (bottom < 0) return undefined;
  return {
    top: top / height,
    bottom: (bottom + 1) / height,
    left: left / width,
    right: (right + 1) / width,
  };
}
