import type { CinematicFrame, FrameDecorator } from "../../../shared/cinematic";
import {
  reportFogFigures,
  type FogFigure,
} from "../../../shared/lib/fog-channel";
import type { ActorTransform } from "./stage-motion";
import { lineupCamera, StageProjection, type CameraPose } from "./stage-view";
import { silhouetteAt, type TroopPlace } from "./troop-place";

const isCamera = (value: unknown): value is CameraPose =>
  typeof value === "object" &&
  value !== null &&
  "position" in value &&
  "target" in value &&
  "fov" in value;

const isTransform = (value: unknown): value is ActorTransform =>
  typeof value === "object" && value !== null && "position" in value;

/**
 * Watches the finished frame and tells the page fog where each member stands
 * on screen, so the fog can flow around them. It never changes the frame; put
 * it last so it sees the camera and positions the renderer will draw.
 */
export class FogPresence implements FrameDecorator {
  private readonly bySlug: ReadonlyMap<string, TroopPlace>;

  constructor(
    places: readonly TroopPlace[],
    private readonly stage: () => HTMLElement | null,
  ) {
    this.bySlug = new Map(places.map((place) => [place.member.slug, place]));
  }

  decorate(frame: CinematicFrame): CinematicFrame {
    const element = this.stage();
    if (!element) return frame;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return frame;

    const cameraValue = frame.commands.find(
      (command) => command.kind === "camera",
    )?.value;
    const projection = new StageProjection(
      rect.width / rect.height,
      isCamera(cameraValue) ? cameraValue : lineupCamera,
    );

    const figures: FogFigure[] = [];
    for (const command of frame.commands) {
      if (command.kind !== "transform" || !isTransform(command.value)) {
        continue;
      }
      const place = this.bySlug.get(command.target);
      if (!place) continue;
      const box = projection.box(silhouetteAt(place, command.value.position));
      figures.push({
        id: command.target,
        x: rect.left + (box.left + box.width / 2) * rect.width,
        feet: rect.top + (box.top + box.height) * rect.height,
        head: rect.top + box.top * rect.height,
        halfWidth: (box.width / 2) * rect.width,
      });
    }
    reportFogFigures(figures);
    return frame;
  }
}
