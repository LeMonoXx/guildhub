import type { GuildProfileResponse } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { Reveal } from "../../../shared/ui";
import { GuildTitle } from "./guild-title";

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
