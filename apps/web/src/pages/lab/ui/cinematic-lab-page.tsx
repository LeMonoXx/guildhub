import { useSearch } from "@tanstack/react-router";
import { LiveCharacterStage } from "../../../widgets/character-cinematic";
import { useLocale } from "../../../shared/i18n";
import { asRecord, numberValue } from "../../../shared/lib";
import { DocumentTitle } from "../../../shared/ui";

export function CinematicLabPage() {
  const { t } = useLocale();
  const previewTimeMs = numberValue(
    asRecord(useSearch({ strict: false })).frame,
  );
  return (
    <div className="lab-page">
      <DocumentTitle value={t("lab.cinematicLabel")} />
      <LiveCharacterStage
        scene="/cinematics/rogue-proof.scene.json"
        manifest="/assets/looks/fixed/look.json"
        assetBase="/assets/"
        posterTimeMs={4300}
        previewTimeMs={previewTimeMs}
        ariaLabel={t("lab.cinematicLabel")}
      />
    </div>
  );
}
