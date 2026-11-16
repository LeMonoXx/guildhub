import type { FeaturedMembersResponse } from "@guildhub/contracts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useModelPolling } from "../../../entities/character";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import { formatDocumentTitle } from "../../../shared/lib";
import {
  DocumentTitle,
  Embers,
  PanelSection,
  Reveal,
  SectionNav,
  StatusBlock,
} from "../../../shared/ui";
import { LiveCharacterStage } from "../../../widgets/character-cinematic";
import { GuildHero } from "../../../widgets/guild-hero";
import { chronicleSections } from "./chronicle-sections";
import { Masthead, TitleCard } from "./guild-masthead";

const featuredModels = (featured: FeaturedMembersResponse) =>
  featured.members.map((member) => member.model);

export function GuildPage() {
  const { t } = useLocale();
  const profile = useQuery(guildQueries.profile());
  const featured = useQuery({
    ...guildQueries.featured(),
    refetchInterval: useModelPolling(featuredModels),
  });
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
          line={t("home.tagline")}
          renderLiveStage={(scene, decorators) => (
            <LiveCharacterStage
              scene={scene}
              decorators={decorators}
              assetBase="/assets/"
              variant="embedded"
              ariaLabel={t("home.stageLabel")}
            />
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
