import { lazy, Suspense } from "react";
import { useLocale } from "../../../shared/i18n";
import { LoadProgress } from "../../../shared/ui";
import type { CharacterCinematicProps } from "./CharacterCinematic";

const CharacterCinematic = lazy(() =>
  import("./CharacterCinematic").then((module) => ({
    default: module.CharacterCinematic,
  })),
);

export type LiveCharacterStageProps = Omit<
  CharacterCinematicProps,
  "loadingLabel" | "preparingLabel" | "readyLabel"
>;

/** The cinematic stage, fetched with Three.js only when a page actually shows it. */
export function LiveCharacterStage(props: LiveCharacterStageProps) {
  const { t } = useLocale();
  return (
    <Suspense
      fallback={
        <div className="model-loading">
          <LoadProgress label={t("model.loading")} fraction={0} />
        </div>
      }
    >
      <CharacterCinematic
        {...props}
        loadingLabel={t("model.loading")}
        preparingLabel={t("model.preparing")}
        readyLabel={t("status.ready")}
      />
    </Suspense>
  );
}
