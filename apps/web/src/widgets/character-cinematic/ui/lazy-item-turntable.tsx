import { lazy, Suspense } from "react";
import type { ItemTurntableProps } from "../../character-model";

const ItemTurntable = lazy(() =>
  import("../../character-model").then((module) => ({
    default: module.ItemTurntable,
  })),
);

/** The item stage, fetched with Three.js only when the armory shows one. */
export function LazyItemTurntable(props: ItemTurntableProps) {
  return (
    <Suspense fallback={null}>
      <ItemTurntable {...props} />
    </Suspense>
  );
}
