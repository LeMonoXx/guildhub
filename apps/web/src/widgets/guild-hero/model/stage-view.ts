export interface Pose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CameraPose {
  readonly position: Pose;
  readonly target: Pose;
  /** Vertical field of view in degrees. */
  readonly fov: number;
}

/** Where the lineup camera stands; occlusion is measured from here. */
export const lineupCamera: CameraPose = {
  position: { x: 0, y: 2.05, z: 9.55 },
  target: { x: 0, y: 1.12, z: 0.4 },
  fov: 38,
};

/** Actors are drawn at this scale once they stand in the lineup. */
export const lineupScale = 1.32;

export interface Silhouette {
  readonly slot: Pose;
  readonly halfWidth: number;
  readonly height: number;
}

interface ScreenRect {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  readonly top: number;
}

const project = (body: Silhouette): ScreenRect => {
  const depth = Math.max(0.5, lineupCamera.position.z - body.slot.z);
  const halfWidth = (body.halfWidth * lineupScale) / depth;
  const centre = body.slot.x / depth;
  return {
    left: centre - halfWidth,
    right: centre + halfWidth,
    bottom: (body.slot.y - lineupCamera.position.y) / depth,
    top:
      (body.slot.y + body.height * lineupScale - lineupCamera.position.y) /
      depth,
  };
};

/**
 * Share of `behind`'s on-screen silhouette hidden by `front`, from 0 to 1.
 * Both are treated as upright boxes seen through a pinhole at the camera.
 */
export const coverage = (front: Silhouette, behind: Silhouette): number => {
  if (front.slot.z <= behind.slot.z) return 0;
  const a = project(front);
  const b = project(behind);
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  if (width <= 0 || height <= 0) return 0;
  const area = (b.right - b.left) * (b.top - b.bottom);
  return area <= 0 ? 0 : (width * height) / area;
};

/** A box on the stage element, as fractions of its width and height. */
export interface StageBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The camera frames the stage's content box. Padding below it is drawn into,
 * so a fraction of that framed view lands this far down the full element.
 */
export function placeOnStage(box: StageBox, framedShare: number): StageBox {
  const share = Math.min(1, Math.max(0.05, framedShare));
  return {
    left: box.left,
    width: box.width,
    top: box.top * share,
    height: box.height * share,
  };
}

type Vector = readonly [number, number, number];

const subtract = (a: Vector, b: Vector): Vector => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vector, b: Vector): Vector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vector): Vector => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const asVector = (pose: Pose): Vector => [pose.x, pose.y, pose.z];

/**
 * Projects stage positions to the element the lineup is drawn in, with the
 * same look-at camera and vertical field of view the renderer uses.
 */
export class StageProjection {
  private readonly eye: Vector;
  private readonly forward: Vector;
  private readonly right: Vector;
  private readonly up: Vector;
  private readonly tanHalfFov: number;

  constructor(
    private readonly aspect: number,
    camera: CameraPose = lineupCamera,
  ) {
    this.eye = asVector(camera.position);
    this.tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);
    this.forward = normalize(subtract(asVector(camera.target), this.eye));
    this.right = normalize(cross(this.forward, [0, 1, 0]));
    this.up = cross(this.right, this.forward);
  }

  /** Fractions of the stage from its top-left corner. */
  point(pose: Pose): { readonly x: number; readonly y: number } {
    const offset = subtract(asVector(pose), this.eye);
    const depth = Math.max(0.01, dot(offset, this.forward));
    const ndcX =
      dot(offset, this.right) / (depth * this.tanHalfFov * this.aspect);
    const ndcY = dot(offset, this.up) / (depth * this.tanHalfFov);
    return { x: (ndcX + 1) / 2, y: (1 - ndcY) / 2 };
  }

  /** Where a standing body shows up on the stage. */
  box(body: Silhouette): StageBox {
    const { x, z } = body.slot;
    const height = body.height * lineupScale;
    const halfWidth = body.halfWidth * lineupScale;
    const feet = this.point({ x, y: 0, z });
    const head = this.point({ x, y: height, z });
    const left = this.point({ x: x - halfWidth, y: height / 2, z });
    const right = this.point({ x: x + halfWidth, y: height / 2, z });
    return {
      left: left.x,
      top: head.y,
      width: right.x - left.x,
      height: feet.y - head.y,
    };
  }
}

/** World-space x shift that moves `front` clear of `behind` on screen. */
export const lateralClearance = (
  front: Silhouette,
  behind: Silhouette,
  allowed: number,
): number => {
  const a = project(front);
  const b = project(behind);
  const height = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
  const backHeight = b.top - b.bottom;
  if (height <= 0 || backHeight <= 0) return 0;
  const allowedWidth = (allowed * backHeight * (b.right - b.left)) / height;
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const excess = width - allowedWidth;
  if (excess <= 0) return 0;
  const depth = Math.max(0.5, lineupCamera.position.z - front.slot.z);
  return excess * depth;
};
