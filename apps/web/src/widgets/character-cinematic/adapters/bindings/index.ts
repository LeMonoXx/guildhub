import { AudioBindingState } from "./audio-binding";
import { ClipBinding } from "./clip-binding";
import { BindingRegistry } from "./registry";
import {
  cameraBinding,
  emitterBinding,
  lightBinding,
  smokeBinding,
  teleportBinding,
  transformBinding,
  uiBinding,
  visibilityBinding,
} from "./scene-bindings";

export { AudioBindingState } from "./audio-binding";
export { ClipBinding } from "./clip-binding";
export {
  BindingRegistry,
  BindingTargetRegistry,
  type BindingContext,
  type BindingDiagnostic,
  type CommandBinding,
} from "./registry";
export type {
  CameraBindingTarget,
  EmitterBindingTarget,
  UiBindingState,
  UiBindingTarget,
} from "./scene-bindings";

export const createDefaultBindings = (): BindingRegistry =>
  new BindingRegistry()
    .register("clip", new ClipBinding())
    .register("transform", transformBinding)
    .register("camera", cameraBinding)
    .register("light", lightBinding)
    .register("visibility", visibilityBinding)
    .register("ui", uiBinding)
    .register("emitter", emitterBinding)
    .register("smoke", smokeBinding)
    .register("teleport", teleportBinding)
    .register("audio", new AudioBindingState());
