import type { GuildProfileResponse } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { Reveal, Wordmark } from "../../../shared/ui";

function GuildTitle({
  guild,
  heading,
  showLine = true,
}: {
  readonly guild: GuildProfileResponse;
  readonly heading?: boolean;
  readonly showLine?: boolean;
}) {
  const { t } = useLocale();
  return (
    <>
      <p className={heading ? "eyebrow masthead-eyebrow" : "eyebrow"}>
        {t("home.eyebrow", { faction: t(`faction.${guild.faction}`) })}
      </p>
      <Wordmark text={guild.name} as={heading ? "h1" : "p"} />
      {showLine ? <p className="guild-tagline">{t("home.tagline")}</p> : null}
    </>
  );
}

/** The guild's name as the opening title over the stage. The line follows on its own. */
export function TitleCard({ guild }: { readonly guild: GuildProfileResponse }) {
  return <GuildTitle guild={guild} showLine={false} />;
}

export function Masthead({ guild }: { readonly guild: GuildProfileResponse }) {
  const { t, locale } = useLocale();
  return (
    <header id="story" className="guild-masthead">
      <div className="masthead-body">
        <Reveal className="masthead-title">
          <GuildTitle guild={guild} heading />
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
