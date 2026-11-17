import { useQuery } from "@tanstack/react-query";
import { guildQueries } from "../../../entities/guild";
import { useLocale } from "../../../shared/i18n";
import { formatDocumentTitle } from "../../../shared/lib";
import {
  CountUp,
  DocumentTitle,
  Embers,
  StatusBlock,
} from "../../../shared/ui";
import { LazyBossModel } from "../../../widgets/character-cinematic";
import { GuildPartyRadar, PartyMap } from "../../../widgets/party";

export function PartyPage() {
  const { t, locale } = useLocale();
  const profile = useQuery(guildQueries.profile());
  const party = useQuery(guildQueries.party());
  const atlas = useQuery(guildQueries.worldMap());

  const title = (
    <DocumentTitle
      value={formatDocumentTitle(t("party.title"), profile.data?.name)}
    />
  );
  if (party.isPending)
    return (
      <>
        {title}
        <StatusBlock>{t("party.loading")}</StatusBlock>
      </>
    );
  if (party.isError)
    return (
      <>
        {title}
        <StatusBlock tone="error">{t("status.error")}</StatusBlock>
      </>
    );

  const ready = party.data.dungeons.filter(
    (dungeon) => dungeon.missing.length === 0,
  ).length;
  const stats = [
    { key: "quests", value: party.data.quests.length },
    { key: "groups", value: ready },
    {
      key: "questing",
      value: party.data.members.filter((m) => m.focus !== undefined).length,
    },
  ];
  return (
    <article className="party-page">
      {title}
      <header className="party-hero">
        <div className="party-hero-glow" aria-hidden="true">
          <Embers density={4} />
        </div>
        <p className="eyebrow">{t("party.eyebrow")}</p>
        <h1>{t("party.title")}</h1>
        <p className="party-hero-lead">{t("party.lead")}</p>
        <dl className="party-stats">
          {stats.map((stat, index) => (
            <div
              key={stat.key}
              style={{ ["--order" as string]: String(index) }}
            >
              <dt>{t(`party.stat.${stat.key}`)}</dt>
              <dd>
                <CountUp value={stat.value} locale={locale} />
              </dd>
            </div>
          ))}
        </dl>
      </header>
      {atlas.data === undefined ? (
        <>
          {!atlas.isPending && (
            <p className="page-notice">{t("party.mapMissing")}</p>
          )}
          <GuildPartyRadar party={party.data} />
        </>
      ) : (
        <PartyMap
          party={party.data}
          atlas={atlas.data}
          renderBoss={(dungeon) => (
            <LazyBossModel
              key={dungeon.key}
              displayId={dungeon.boss.displayId}
              assetBase="/assets/"
              className="party-boss-canvas"
            />
          )}
        />
      )}
    </article>
  );
}
