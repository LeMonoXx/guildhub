import type { CharacterDetailResponse } from "@guildhub/contracts";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  CharacterNotFoundError,
  characterQueries,
  useModelPolling,
} from "../../../entities/character";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import {
  asRecord,
  formatDocumentTitle,
  stringValue,
} from "../../../shared/lib";
import {
  DocumentTitle,
  PanelSection,
  SectionNav,
  StatusBlock,
} from "../../../shared/ui";
import { CharacterBackdrop } from "../../../widgets/character-cinematic";
import { CharacterHero } from "../../../widgets/character-hero";
import { profileSections } from "./profile-sections";

const detailModels = (detail: CharacterDetailResponse) => [detail.model];

export function CharacterPage() {
  const { t } = useLocale();
  const characterSlug =
    stringValue(asRecord(useParams({ strict: false })).characterSlug) ?? "";
  const guild = useQuery(guildQueries.profile());
  const character = useQuery({
    ...characterQueries.detail(characterSlug),
    refetchInterval: useModelPolling(detailModels),
  });
  const profile = useQuery({
    ...characterQueries.profile(characterSlug),
    enabled: character.isSuccess,
  });
  const party = useQuery(guildQueries.party());
  const history = useQuery({
    ...characterQueries.history(characterSlug),
    enabled: character.isSuccess,
  });

  if (character.isPending)
    return <StatusBlock>{t("character.loading")}</StatusBlock>;
  if (character.isError && character.error instanceof CharacterNotFoundError)
    return <StatusBlock>{t("character.notFound")}</StatusBlock>;
  if (character.isError)
    return <StatusBlock tone="error">{t("character.error")}</StatusBlock>;

  const detail = character.data;
  const available =
    profile.data?.status === "available" ? profile.data : undefined;
  const sections = available
    ? profileSections(available, detail, history.data, party.data, t)
    : [];
  const profileFallback = profile.isPending ? (
    <StatusBlock>{t("character.profileLoading")}</StatusBlock>
  ) : (
    <p className="page-notice">{t("character.profileUnavailable")}</p>
  );

  return (
    <article className="character-page">
      <DocumentTitle
        value={formatDocumentTitle(detail.name, guild.data?.name)}
      />
      <div className="character-body">
        <CharacterBackdrop detail={detail} />
        {sections.length > 0 ? (
          <SectionNav
            label={t("character.sectionNav")}
            sections={sections.map((section) => section.link)}
          />
        ) : null}
        <CharacterHero character={detail} profile={available} />
        {detail.published ? null : (
          <p className="page-notice">{t("character.unpublished")}</p>
        )}
        {sections.length > 0
          ? sections.map((section) => (
              <PanelSection
                key={section.link.id}
                id={section.link.id}
                eyebrow={section.eyebrow}
                title={section.link.label}
                lead={section.lead}
              >
                {section.body}
              </PanelSection>
            ))
          : profileFallback}
      </div>
    </article>
  );
}
