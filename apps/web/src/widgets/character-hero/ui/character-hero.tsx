import type {
  CharacterDetailResponse,
  CharacterProfileResponse,
} from "@guildhub/contracts";
import {
  ClassColoredName,
  ClassMark,
  RaceMark,
  powerColorVar,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatRelativeTime } from "../../../shared/lib";
import { CountUp, Embers, FallbackImage } from "../../../shared/ui";

interface CharacterHeroProps {
  readonly character: CharacterDetailResponse;
  readonly profile?: CharacterProfileResponse | undefined;
}

function UnitFrame({ character, profile }: CharacterHeroProps) {
  const { t, locale } = useLocale();
  const stats = profile?.statistics;
  const avatar = profile?.avatarUrl;
  return (
    <div className="unit-frame">
      <div className="unit-frame-portrait">
        <FallbackImage
          src={avatar}
          fallback={<RaceMark raceId={character.raceId} />}
        />
        <span className="unit-frame-level" title={t("members.level")}>
          {character.level}
        </span>
      </div>
      <div className="unit-frame-bars">
        <p className="unit-frame-name">
          <ClassColoredName classId={character.classId}>
            {character.name}
          </ClassColoredName>
        </p>
        <div
          className="unit-frame-bar unit-frame-health"
          style={{ ["--bar-color" as string]: "var(--power-health)" }}
        >
          <span>
            {stats ? <CountUp value={stats.health} locale={locale} /> : "—"}
          </span>
        </div>
        <div
          className="unit-frame-bar"
          style={{
            ["--bar-color" as string]: powerColorVar(stats?.powerType),
          }}
        >
          <span>
            {stats ? <CountUp value={stats.power} locale={locale} /> : "—"}{" "}
            {stats?.powerType ? (
              <small>{t(`power.${stats.powerType.toLowerCase()}`)}</small>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CharacterHero({ character, profile }: CharacterHeroProps) {
  const { t, locale } = useLocale();
  const summary = profile?.summary;
  const facts = [
    {
      key: "itemLevel",
      value: summary?.equippedItemLevel ?? summary?.averageItemLevel,
    },
    { key: "achievementPoints", value: profile?.achievements.points },
    { key: "questsCompleted", value: profile?.quests.completedCount },
    { key: "honorableKills", value: profile?.pvp?.honorableKills },
    { key: "mounts", value: profile?.collections.mounts.length },
    { key: "companions", value: profile?.collections.pets.length },
  ].filter(
    (fact): fact is { key: string; value: number } => fact.value !== undefined,
  );

  return (
    <header
      className="character-hero"
      style={{
        ["--hero-class" as string]: wowClassColorVar(character.classId),
      }}
    >
      <div className="character-hero-light" aria-hidden="true" />
      <Embers density={4} />
      <div className="character-hero-body">
        <UnitFrame character={character} profile={profile} />
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
      </div>
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
    </header>
  );
}
