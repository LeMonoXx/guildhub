import type {
  CharacterDetailResponse,
  CharacterHistoryResponse,
  CharacterProfileResponse,
} from "@guildhub/contracts";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CharacterNotFoundError,
  characterQueries,
  modelPollInterval,
  raceHeight,
  wowClassColorVar,
} from "../../../entities/character";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import {
  asRecord,
  formatDocumentTitle,
  liveStageMediaQuery,
  measureFigureBounds,
  stringValue,
  useMediaQuery,
  type FigureBounds,
} from "../../../shared/lib";
import {
  DocumentTitle,
  FallbackImage,
  LoadProgress,
  PanelSection,
  SectionNav,
  StatusBlock,
  type SectionLink,
} from "../../../shared/ui";
import { CharacterArmory } from "../../../widgets/character-armory";
import { CharacterAttributes } from "../../../widgets/character-attributes";
import { buildCharacterIdleScene } from "../../../widgets/character-cinematic";
import { CharacterCollections } from "../../../widgets/character-collections";
import { CharacterDeeds } from "../../../widgets/character-deeds";
import { CharacterHero } from "../../../widgets/character-hero";
import { CharacterHistory } from "../../../widgets/character-history";
import { CharacterProfessions } from "../../../widgets/character-professions";
import { CharacterReputations } from "../../../widgets/character-reputations";
import { CharacterTalents } from "../../../widgets/character-talents";

const CharacterCinematic = lazy(() =>
  import("../../../widgets/character-cinematic").then((module) => ({
    default: module.CharacterCinematic,
  })),
);

function CharacterPoster({ src }: { readonly src: string | undefined }) {
  const [figure, setFigure] = useState<FigureBounds | undefined>();
  const style = figure && {
    ["--figure-top" as string]: String(figure.top),
    ["--figure-height" as string]: String(figure.bottom - figure.top),
    ["--figure-center" as string]: String((figure.left + figure.right) / 2),
  };
  return (
    <FallbackImage
      className="character-poster"
      src={src}
      fallback={null}
      data-framed={figure !== undefined}
      style={style}
      onLoad={(event) => {
        setFigure(measureFigureBounds(event.currentTarget));
      }}
    />
  );
}

function CharacterBackdrop({
  detail,
}: {
  readonly detail: CharacterDetailResponse;
}) {
  const { t } = useLocale();
  const liveCapable = useMediaQuery(liveStageMediaQuery);
  const live = liveCapable && detail.model.status === "ready";
  const baking = liveCapable && detail.model.status === "pending";
  const figureHeight = raceHeight(detail.raceId);
  const scene = useMemo(
    () =>
      buildCharacterIdleScene({
        id: detail.slug,
        manifest: detail.lookManifest,
        figureHeight,
        framing: "bust",
      }),
    [detail.slug, detail.lookManifest, figureHeight],
  );
  return (
    <div
      className="character-backdrop"
      data-live={live}
      style={{ ["--hero-class" as string]: wowClassColorVar(detail.classId) }}
    >
      <div className="character-backdrop-frame">
        <div className="character-backdrop-glow" aria-hidden="true" />
        <CharacterPoster key={detail.renderUrl} src={detail.renderUrl} />
        {live ? (
          <Suspense
            fallback={
              <div className="model-loading">
                <LoadProgress label={t("model.loading")} fraction={0} />
              </div>
            }
          >
            <CharacterCinematic
              scene={scene}
              fitToActorHeight={figureHeight}
              manifest={detail.lookManifest}
              assetBase="/assets/"
              variant="embedded"
              ariaLabel={t("character.stageLabel")}
              loadingLabel={t("model.loading")}
              preparingLabel={t("model.preparing")}
              readyLabel={t("status.ready")}
            />
          </Suspense>
        ) : null}
        {baking ? (
          <div className="model-loading">
            <LoadProgress label={t("model.baking")} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface Section {
  readonly link: SectionLink;
  readonly eyebrow: string;
  readonly lead?: string;
  readonly body: ReactNode;
}

const profileSections = (
  profile: CharacterProfileResponse,
  detail: CharacterDetailResponse,
  history: CharacterHistoryResponse | undefined,
  t: (key: string, values?: Record<string, string | number>) => string,
): Section[] => {
  const sections: (Section | false)[] = [
    {
      link: { id: "armory", label: t("character.section.armory") },
      eyebrow: t("character.eyebrow.armory"),
      lead: t("character.lead.armory"),
      body: <CharacterArmory items={profile.equipment} />,
    },
    profile.statistics !== undefined && {
      link: { id: "attributes", label: t("character.section.attributes") },
      eyebrow: t("character.eyebrow.attributes"),
      body: <CharacterAttributes statistics={profile.statistics} />,
    },
    profile.specializations.length > 0 && {
      link: { id: "talents", label: t("character.section.talents") },
      eyebrow: t("character.eyebrow.talents"),
      body: (
        <CharacterTalents
          specializations={profile.specializations}
          talentTrees={profile.talentTrees}
          classColor={wowClassColorVar(detail.classId)}
        />
      ),
    },
    profile.professions.length > 0 && {
      link: { id: "professions", label: t("character.section.professions") },
      eyebrow: t("character.eyebrow.professions"),
      body: <CharacterProfessions professions={profile.professions} />,
    },
    profile.reputations.length > 0 && {
      link: { id: "reputations", label: t("character.section.reputations") },
      eyebrow: t("character.eyebrow.reputations"),
      body: <CharacterReputations reputations={profile.reputations} />,
    },
    {
      link: { id: "deeds", label: t("character.section.deeds") },
      eyebrow: t("character.eyebrow.deeds"),
      body: <CharacterDeeds profile={profile} />,
    },
    history !== undefined && {
      link: { id: "history", label: t("character.section.history") },
      eyebrow: t("character.eyebrow.history"),
      lead: t("character.lead.history"),
      body: <CharacterHistory history={history} classId={detail.classId} />,
    },
    {
      link: { id: "collections", label: t("character.section.collections") },
      eyebrow: t("character.eyebrow.collections"),
      body: <CharacterCollections profile={profile} />,
    },
  ];
  return sections.filter((section): section is Section => section !== false);
};

export function CharacterPage() {
  const { t } = useLocale();
  const characterSlug =
    stringValue(asRecord(useParams({ strict: false })).characterSlug) ?? "";
  const guild = useQuery(guildQueries.profile());
  const pendingSince = useRef<number | undefined>(undefined);
  const character = useQuery({
    ...characterQueries.detail(characterSlug),
    refetchInterval: (query) => {
      if (query.state.data?.model.status !== "pending") {
        pendingSince.current = undefined;
        return false;
      }
      pendingSince.current ??= Date.now();
      return modelPollInterval(
        query.state.data.model.status,
        Date.now() - pendingSince.current,
      );
    },
  });
  const profile = useQuery({
    ...characterQueries.profile(characterSlug),
    enabled: character.isSuccess,
  });
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
    ? profileSections(available, detail, history.data, t)
    : [];

  return (
    <article className="character-page">
      <DocumentTitle
        value={formatDocumentTitle(detail.name, guild.data?.name)}
      />
      <div className="character-body">
        <CharacterBackdrop detail={detail} />
        <CharacterHero character={detail} profile={available} />
        {detail.published ? null : (
          <p className="page-notice">{t("character.unpublished")}</p>
        )}
        {sections.length > 0 ? (
          <>
            <SectionNav
              label={t("character.sectionNav")}
              sections={sections.map((section) => section.link)}
            />
            {sections.map((section) => (
              <PanelSection
                key={section.link.id}
                id={section.link.id}
                eyebrow={section.eyebrow}
                title={section.link.label}
                lead={section.lead}
              >
                {section.body}
              </PanelSection>
            ))}
          </>
        ) : (
          <>
            {profile.isPending ? (
              <StatusBlock>{t("character.profileLoading")}</StatusBlock>
            ) : (
              <p className="page-notice">{t("character.profileUnavailable")}</p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
