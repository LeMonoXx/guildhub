import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import { formatDocumentTitle } from "../../../shared/lib";
import { DocumentTitle, StatusBlock, Wordmark } from "../../../shared/ui";
import { GuildHero } from "../../../widgets/guild-hero";

const CharacterCinematic = lazy(() =>
  import("../../../widgets/character-cinematic").then((module) => ({
    default: module.CharacterCinematic,
  })),
);

export function GuildPage() {
  const { t } = useLocale();
  const profile = useQuery(guildQueries.profile());
  const featured = useQuery(guildQueries.featured());

  if (profile.isPending || featured.isPending)
    return <StatusBlock>{t("status.loading")}</StatusBlock>;
  if (profile.isError || featured.isError)
    return <StatusBlock tone="error">{t("status.error")}</StatusBlock>;

  const guild = profile.data;
  const featuredMembers = featured.data;
  return (
    <article className="guild-page">
      <DocumentTitle value={formatDocumentTitle(guild.name)} />
      <header className="guild-masthead">
        <Wordmark text={guild.name} as="h1" />
        <p className="guild-tagline">{t("home.tagline")}</p>
        <dl className="guild-stats">
          <div>
            <dt>{t("home.statsMembers")}</dt>
            <dd>{guild.memberCount}</dd>
          </div>
          <div>
            <dt>{t("home.statsPoints")}</dt>
            <dd>{guild.achievementPoints}</dd>
          </div>
        </dl>
      </header>
      <GuildHero
        members={featuredMembers.members}
        renderLiveStage={(scene) => (
          <Suspense fallback={null}>
            <CharacterCinematic
              scene={scene}
              assetBase="/assets/"
              variant="embedded"
              ariaLabel={t("home.stageLabel")}
              loadingLabel={t("status.loading")}
              readyLabel={t("status.ready")}
            />
          </Suspense>
        )}
      />
      <section className="guild-about">
        <h2>{t("home.aboutTitle")}</h2>
        <p>{t("home.aboutBody")}</p>
      </section>
    </article>
  );
}
