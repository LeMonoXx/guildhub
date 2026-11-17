import type { WorldMapZone } from "@guildhub/contracts";
import { zoneCenter, type Camera } from "./map-layout";

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
/** From this zoom on, the zone in the middle of the stage shows its detailed map. */
export const ZONE_SCALE = 2;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Keeps the zoom in range and the map covering the whole stage. */
export function clampCamera(camera: Camera): Camera {
  const scale = clampNumber(camera.scale, MIN_SCALE, MAX_SCALE);
  const edge = (1 - scale) * 100;
  return {
    scale,
    x: clampNumber(camera.x, edge, 0),
    y: clampNumber(camera.y, edge, 0),
  };
}

/** Moves the map by a distance in percent of the stage. */
export const panBy = (camera: Camera, dx: number, dy: number): Camera =>
  clampCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });

/**
 * Zooms by `factor` while the map point under the stage spot `fx`, `fy`
 * (both 0..1) stays where it is.
 */
export function zoomAt(
  camera: Camera,
  factor: number,
  fx: number,
  fy: number,
): Camera {
  const scale = clampNumber(camera.scale * factor, MIN_SCALE, MAX_SCALE);
  const pointX = (fx * 100 - camera.x) / camera.scale;
  const pointY = (fy * 100 - camera.y) / camera.scale;
  return clampCamera({
    scale,
    x: fx * 100 - pointX * scale,
    y: fy * 100 - pointY * scale,
  });
}

export const sameCamera = (a: Camera, b: Camera): boolean =>
  a.scale === b.scale && a.x === b.x && a.y === b.y;

/** The zone under the middle of the stage, once the camera is close enough to read it. */
export function focusedZone(
  zones: readonly WorldMapZone[],
  camera: Camera,
): WorldMapZone | undefined {
  if (camera.scale < ZONE_SCALE) return undefined;
  const x = (50 - camera.x) / camera.scale / 100;
  const y = (50 - camera.y) / camera.scale / 100;
  const distance = (zone: WorldMapZone) => {
    const center = zoneCenter(zone);
    return Math.hypot(center.x - x, center.y - y);
  };
  return zones
    .filter(
      (zone) =>
        zone.image !== null &&
        x >= zone.rect.left &&
        x <= zone.rect.right &&
        y >= zone.rect.top &&
        y <= zone.rect.bottom,
    )
    .sort((a, b) => distance(a) - distance(b))[0];
}
