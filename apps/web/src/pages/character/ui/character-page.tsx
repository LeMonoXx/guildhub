import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
  CharacterNotFoundError,
  characterQueries,
} from "../../../entities/character";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import {
  asRecord,
  formatDocumentTitle,
  stringValue,
} from "../../../shared/lib";
import { DocumentTitle, StatusBlock } from "../../../shared/ui";
import { CharacterProfile } from "../../../widgets/character-profile";

const CharacterCinematic = lazy(() =>
  import("../../../widgets/character-cinematic").then((module) => ({
    default: module.CharacterCinematic,
  })),
);

export function CharacterPage() {
  const { t } = useLocale();
  const characterSlug =
    stringValue(asRecord(useParams({ strict: false })).characterSlug) ?? "";
  const profile = useQuery(guildQueries.profile());
  const character = useQuery(characterQueries.detail(characterSlug));

  if (character.isPending)
    return <StatusBlock>{t("character.loading")}</StatusBlock>;
  if (character.isError && character.error instanceof CharacterNotFoundError)
    return <StatusBlock>{t("character.notFound")}</StatusBlock>;
  if (character.isError)
    return <StatusBlock tone="error">{t("character.error")}</StatusBlock>;

  const detail = character.data;
  return (
    <article className="character-page">
      <DocumentTitle
        value={formatDocumentTitle(detail.name, profile.data?.name)}
      />
      <div className="character-stage">
        <Suspense fallback={<StatusBlock>{t("status.loading")}</StatusBlock>}>
          <CharacterCinematic
            scene={detail.cinematicScene}
            manifest={detail.lookManifest}
            assetBase="/assets/"
            variant="embedded"
            ariaLabel={t("character.stageLabel")}
            loadingLabel={t("character.loading")}
            readyLabel={t("status.ready")}
          />
        </Suspense>
      </div>
      <CharacterProfile character={detail} />
    </article>
  );
}
