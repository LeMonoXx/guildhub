import type * as THREE from "three";
import type { SmokeEffect, SmokeValues } from "../smoke-effect";
import type { TeleportEffect, TeleportValues } from "../teleport-effect";
import type { CommandBinding } from "./registry";

type Vector = Readonly<{ x: number; y: number; z: number }>;

export interface UiBindingState {
  readonly opacity: number;
  readonly translation: Vector;
  readonly scale: number;
  readonly blur: number;
}

export interface UiBindingTarget {
  setState(state: UiBindingState): void;
}

export interface CameraBindingTarget {
  setCamera(position: Vector, target: Vector, fov: number): void;
}

export interface EmitterBindingTarget {
  apply(value: unknown, timeMs: number): void;
}

export const transformBinding: CommandBinding<THREE.Object3D> = {
  apply(target, command) {
    const value = command.value as {
      position: Vector;
      rotation: Vector;
      scale: Vector;
    };
    target.position.set(value.position.x, value.position.y, value.position.z);
    target.rotation.set(value.rotation.x, value.rotation.y, value.rotation.z);
    target.scale.set(value.scale.x, value.scale.y, value.scale.z);
  },
};

export const cameraBinding: CommandBinding<CameraBindingTarget> = {
  apply(target, command) {
    const value = command.value as {
      position: Vector;
      target: Vector;
      fov: number;
    };
    target.setCamera(value.position, value.target, value.fov);
  },
};

export const lightBinding: CommandBinding<THREE.Light> = {
  apply(target, command) {
    const value = command.value as {
      position: Vector;
      color: string;
      intensity: number;
    };
    target.position.set(value.position.x, value.position.y, value.position.z);
    target.color.set(value.color);
    target.intensity = value.intensity;
  },
};

export const visibilityBinding: CommandBinding<THREE.Object3D> = {
  apply(target, command) {
    target.visible = Boolean(command.value);
  },
};

export const uiBinding: CommandBinding<UiBindingTarget> = {
  apply(target, command) {
    target.setState(command.value as UiBindingState);
  },
};

export const emitterBinding: CommandBinding<EmitterBindingTarget> = {
  apply(target, command, context) {
    target.apply(command.value, context.frame.timeMs);
  },
};

export const smokeBinding: CommandBinding<SmokeEffect> = {
  apply(target, command, context) {
    target.apply(command.value as SmokeValues, context.frame.timeMs);
  },
};

export const teleportBinding: CommandBinding<TeleportEffect> = {
  apply(target, command, context) {
    target.apply(command.value as TeleportValues, context.frame.elapsedMs);
  },
};
