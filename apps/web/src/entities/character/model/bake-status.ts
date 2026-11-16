import type { CharacterModelBake } from "@guildhub/contracts";

export interface BakeStatus {
  readonly label: string;
  /** Known only while the baker works on this look. */
  readonly fraction?: number;
}

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const statusByState: Readonly<
  Record<
    CharacterModelBake["state"],
    (bake: CharacterModelBake, t: Translate) => BakeStatus
  >
> = {
  queued: (bake, t) => ({
    label:
      bake.position === undefined
        ? t("model.queued")
        : t("model.queuedAt", { position: bake.position }),
  }),
  opening: (_bake, t) => ({ label: t("model.opening") }),
  baking: (bake, t) => ({
    label: t("model.baking"),
    fraction: bake.fraction ?? 0,
  }),
};

/** What a waiting figure says about its model: its place in line, or how far it is. */
export function bakeStatus(
  bake: CharacterModelBake | undefined,
  t: Translate,
): BakeStatus {
  if (!bake) return { label: t("model.baking") };
  return statusByState[bake.state](bake, t);
}
