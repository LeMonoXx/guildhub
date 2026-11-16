import type {
  CharacterDetailResponse,
  CharacterProfileResponse,
} from "@guildhub/contracts";
import {
  ClassColoredName,
  ClassMark,
  RaceMark,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatRelativeTime } from "../../../shared/lib";
import { CountUp, Embers } from "../../../shared/ui";
import { heroFacts } from "../model/hero-facts";
import { UnitFrame } from "./unit-frame";

interface CharacterHeroProps {
  readonly character: CharacterDetailResponse;
  readonly profile?: CharacterProfileResponse | undefined;
}

/** Who this is and their headline numbers, beside the standing character. */
export function CharacterHero({ character, profile }: CharacterHeroProps) {
  const { t, locale } = useLocale();
  const summary = profile?.summary;
  const facts = heroFacts(profile);
  return (
    <header
      className="character-hero"
      style={{
        ["--hero-class" as string]: wowClassColorVar(character.classId),
      }}
    >
      <div className="character-hero-light" aria-hidden="true" />
      <Embers density={4} />
      <div className="character-hero-title">
        <p className="eyebrow">
          {summary?.guild
            ? t("character.guildRank", {
                rank: t(`rank.${String(character.rankId)}`),
                guild: summary.guild,
              })
            : t(`rank.${String(character.rankId)}`)}
        </p>
        <h1 className="character-hero-name">
          <ClassColoredName classId={character.classId}>
            <span className="reveal-name">{character.name}</span>
          </ClassColoredName>
        </h1>
        <p className="character-hero-surname">
          {summary?.activeTitle ? (
            <span className="character-hero-title-badge">
              {summary.activeTitle}
            </span>
          ) : null}
          {character.surname}
        </p>
        <ul className="character-hero-badges">
          <li className="wow-badge">
            <ClassMark classId={character.classId} />
            <ClassColoredName classId={character.classId}>
              {t(`class.${character.classId}`)}
            </ClassColoredName>
          </li>
          <li className="wow-badge">
            <RaceMark raceId={character.raceId} />
            <span>{t(`race.${character.raceId}`)}</span>
          </li>
          {summary?.faction ? (
            <li
              className="wow-badge faction-badge"
              data-faction={summary.faction.toLowerCase()}
            >
              {summary.faction}
            </li>
          ) : null}
          {summary?.lastLoginAt ? (
            <li className="wow-badge last-seen">
              <span className="pulse-dot" aria-hidden="true" />
              {t("character.lastSeen", {
                when: formatRelativeTime(summary.lastLoginAt, locale),
              })}
            </li>
          ) : null}
        </ul>
      </div>
      <div className="character-hero-body">
        <UnitFrame character={character} profile={profile} />
        {facts.length > 0 ? (
          <dl className="character-hero-facts">
            {facts.map((fact, index) => (
              <div
                key={fact.key}
                className="hero-fact"
                style={{ animationDelay: `${String(300 + index * 90)}ms` }}
              >
                <dt>{t(`character.fact.${fact.key}`)}</dt>
                <dd>
                  <CountUp value={fact.value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}
