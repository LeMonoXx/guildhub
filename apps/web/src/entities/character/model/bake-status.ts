import type { CharacterModelBake } from "@guildhub/contracts";

export interface BakeStatus {
  readonly label: string;
  /** Known only while the baker works on this look. */
  readonly fraction?: number;
}

/** What a waiting figure says about its model: its place in line, or how far it is. */
export function bakeStatus(
  bake: CharacterModelBake | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): BakeStatus {
  if (bake?.state === "queued")
    return {
      label:
        bake.position === undefined
          ? t("model.queued")
          : t("model.queuedAt", { position: bake.position }),
    };
  if (bake?.state === "opening") return { label: t("model.opening") };
  if (bake?.state === "baking")
    return { label: t("model.baking"), fraction: bake.fraction ?? 0 };
  return { label: t("model.baking") };
}
