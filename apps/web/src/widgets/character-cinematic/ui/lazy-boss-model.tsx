import { lazy, Suspense } from "react";
import type { BossModelProps } from "../../character-model";

const BossModel = lazy(() =>
  import("../../character-model").then((module) => ({
    default: module.BossModel,
  })),
);

/** A dungeon boss, fetched with Three.js only when the map first shows one. */
export function LazyBossModel(props: BossModelProps) {
  return (
    <Suspense fallback={null}>
      <BossModel {...props} />
    </Suspense>
  );
}
