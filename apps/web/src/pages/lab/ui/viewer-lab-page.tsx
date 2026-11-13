import { CharacterModelViewer } from "../../../widgets/character-model";
import { useLocale } from "../../../shared/i18n";
import { DocumentTitle } from "../../../shared/ui";

export function ViewerLabPage() {
  const { t } = useLocale();
  return (
    <div className="lab-page">
      <DocumentTitle value={t("lab.viewerLabel")} />
      <CharacterModelViewer />
    </div>
  );
}
