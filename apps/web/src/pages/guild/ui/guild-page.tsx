import type {
  GuildChronicleResponse,
  GuildHistoryResponse,
  GuildProfileResponse,
} from "@guildhub/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { lazy, Suspense, type ReactNode } from "react";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import { formatDocumentTitle, formatNumber } from "../../../shared/lib";
import {
  DocumentTitle,
  Embers,
  PanelSection,
  Reveal,
  SectionNav,
  StatusBlock,
  Wordmark,
  type SectionLink,
} from "../../../shared/ui";
import { GuildBestiary } from "../../../widgets/guild-bestiary";
import { GuildComposition } from "../../../widgets/guild-composition";
import { GuildCrafters } from "../../../widgets/guild-crafters";
import { GuildDossiers } from "../../../widgets/guild-dossiers";
import { GuildHallOfFame } from "../../../widgets/guild-hall-of-fame";
import { GuildHero } from "../../../widgets/guild-hero";
import { GuildHistory } from "../../../widgets/guild-history";
import { GuildPulse } from "../../../widgets/guild-pulse";
import { GuildTimeline } from "../../../widgets/guild-timeline";

const CharacterCinematic = lazy(() =>
  import("../../../widgets/character-cinematic").then((module) => ({
    default: module.CharacterCinematic,
  })),
);

interface Section {
  readonly link: SectionLink;
  readonly eyebrow: string;
  readonly lead?: string;
  readonly body: ReactNode;
}

const chronicleSections = (
  chronicle: GuildChronicleResponse,
  history: GuildHistoryResponse | undefined,
  guild: GuildProfileResponse,
  t: (key: string, values?: Record<string, string | number>) => string,
): Section[] => {
  const sections: (Section | false)[] = [
    {
      link: { id: "pulse", label: t("home.section.pulse") },
      eyebrow: t("home.eyebrow.pulse"),
      lead: t("home.lead.pulse"),
      body: (
        <GuildPulse chronicle={chronicle} memberCount={guild.memberCount} />
      ),
    },
    history !== undefined && {
      link: { id: "history", label: t("home.section.history") },
      eyebrow: t("home.eyebrow.history"),
      lead: t("home.lead.history"),
      body: <GuildHistory history={history} />,
    },
    chronicle.hallOfFame.length > 0 && {
      link: { id: "fame", label: t("home.section.fame") },
      eyebrow: t("home.eyebrow.fame"),
      lead: t("home.lead.fame"),
      body: <GuildHallOfFame hallOfFame={chronicle.hallOfFame} />,
    },
    {
      link: { id: "composition", label: t("home.section.composition") },
      eyebrow: t("home.eyebrow.composition"),
      body: <GuildComposition chronicle={chronicle} />,
    },
    chronicle.dossiers.length > 0 && {
      link: { id: "dossiers", label: t("home.section.dossiers") },
      eyebrow: t("home.eyebrow.dossiers"),
      lead: t("home.lead.dossiers"),
      body: <GuildDossiers dossiers={chronicle.dossiers} />,
    },
    {
      link: { id: "bestiary", label: t("home.section.bestiary") },
      eyebrow: t("home.eyebrow.bestiary"),
      lead: t("home.lead.bestiary"),
      body: <GuildBestiary bestiary={chronicle.bestiary} />,
    },
    {
      link: { id: "crafters", label: t("home.section.crafters") },
      eyebrow: t("home.eyebrow.crafters"),
      lead: t("home.lead.crafters"),
      body: <GuildCrafters professions={chronicle.professions} />,
    },
    {
      link: { id: "timeline", label: t("home.section.timeline") },
      eyebrow: t("home.eyebrow.timeline"),
      body: <GuildTimeline timeline={chronicle.timeline} />,
    },
  ];
  return sections.filter((section): section is Section => section !== false);
};

/** The guild's name as the opening title over the stage. */
function TitleCard({ guild }: { readonly guild: GuildProfileResponse }) {
  const { t } = useLocale();
  return (
    <>
      <p className="eyebrow">
        {t("home.eyebrow", { faction: t(`faction.${guild.faction}`) })}
      </p>
      <Wordmark text={guild.name} />
      <p className="guild-tagline">{t("home.tagline")}</p>
    </>
  );
}

function Masthead({ guild }: { readonly guild: GuildProfileResponse }) {
  const { t, locale } = useLocale();
  return (
    <header id="story" className="guild-masthead">
      <div className="masthead-body">
        <Reveal className="masthead-title">
          <p className="eyebrow masthead-eyebrow">
            {t("home.eyebrow", { faction: t(`faction.${guild.faction}`) })}
          </p>
          <Wordmark text={guild.name} as="h1" />
          <p className="guild-tagline">{t("home.tagline")}</p>
        </Reveal>
        <Reveal className="masthead-copy" delayMs={120}>
          <p className="masthead-pitch">{t("home.pitch")}</p>
          <div className="masthead-actions">
            <Link to="/members" className="button button-primary">
              {t("home.ctaRoster")}
            </Link>
            <a href="#pulse" className="button button-ghost">
              {t("home.ctaChronicle")}
            </a>
          </div>
        </Reveal>
        <Reveal className="masthead-stats" delayMs={240}>
          <dl className="guild-stats">
            <div>
              <dt>{t("home.statsMembers")}</dt>
              <dd>{formatNumber(guild.memberCount, locale)}</dd>
            </div>
            <div>
              <dt>{t("home.statsPoints")}</dt>
              <dd>{formatNumber(guild.achievementPoints, locale)}</dd>
            </div>
            <div>
              <dt>{t("home.statsFaction")}</dt>
              <dd>{t(`faction.${guild.faction}`)}</dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </header>
  );
}

export function GuildPage() {
  const { t } = useLocale();
  const profile = useQuery(guildQueries.profile());
  const featured = useQuery(guildQueries.featured());
  const chronicle = useQuery(guildQueries.chronicle());
  const history = useQuery(guildQueries.history());

  if (profile.isPending || featured.isPending)
    return <StatusBlock>{t("status.loading")}</StatusBlock>;
  if (profile.isError || featured.isError)
    return <StatusBlock tone="error">{t("status.error")}</StatusBlock>;

  const guild = profile.data;
  const sections = chronicle.data
    ? chronicleSections(chronicle.data, history.data, guild, t)
    : [];
  return (
    <article className="guild-page">
      <DocumentTitle value={formatDocumentTitle(guild.name)} />
      <div className="guild-opening" data-faction={guild.faction.toLowerCase()}>
        <div className="opening-backdrop" aria-hidden="true">
          <div className="masthead-beams">
            <span />
            <span />
            <span />
          </div>
          <Embers density={5} />
          <span className="opening-floor" />
        </div>
        <GuildHero
          members={featured.data.members}
          intro={<TitleCard guild={guild} />}
          renderLiveStage={(scene, decorators) => (
            <Suspense fallback={null}>
              <CharacterCinematic
                scene={scene}
                decorators={decorators}
                assetBase="/assets/"
                variant="embedded"
                ariaLabel={t("home.stageLabel")}
                loadingLabel={t("status.loading")}
                readyLabel={t("status.ready")}
              />
            </Suspense>
          )}
        />
        <a className="opening-cue" href="#story">
          <span>{t("home.scrollCue")}</span>
        </a>
        <Masthead guild={guild} />
      </div>
      {sections.length > 0 ? (
        <>
          <SectionNav
            label={t("home.sectionNav")}
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
      ) : chronicle.isError ? (
        <p className="page-notice">{t("home.chronicleError")}</p>
      ) : (
        <div className="chronicle-loading" aria-live="polite">
          <span className="rune-spinner" aria-hidden="true" />
          {t("home.chronicleLoading")}
        </div>
      )}
      <Reveal className="guild-about">
        <h2>{t("home.aboutTitle")}</h2>
        <p>{t("home.aboutBody")}</p>
        <Link to="/members" className="button button-primary">
          {t("home.ctaRoster")}
        </Link>
      </Reveal>
    </article>
  );
}
