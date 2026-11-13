export const liveStageMediaQuery =
  "(min-width: 56.25rem) and (prefers-reduced-motion: no-preference)";

export interface StageCapability {
  readonly webgl: boolean;
  readonly visible: boolean;
  readonly mediaMatches: boolean;
}

export const canUseLiveStage = (capability: StageCapability): boolean =>
  capability.webgl && capability.visible && capability.mediaMatches;

export const detectWebGL = (
  createCanvas: () => HTMLCanvasElement = () =>
    globalThis.document.createElement("canvas"),
): boolean => {
  try {
    const canvas = createCanvas();
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
};
