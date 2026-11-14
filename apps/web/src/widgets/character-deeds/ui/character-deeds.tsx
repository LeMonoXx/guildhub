import type { CharacterProfileResponse } from "@guildhub/contracts";
import { useId, useState } from "react";
import { AchievementHover, AchievementIcon } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatDate, formatNumber } from "../../../shared/lib";
import { CountUp, Reveal } from "../../../shared/ui";

interface CharacterDeedsProps {
  readonly profile: CharacterProfileResponse;
}

function Achievements({ profile }: CharacterDeedsProps) {
  const { t, locale } = useLocale();
  const { achievements } = profile;
  const biggest = Math.max(
    1,
    ...achievements.categories.map((c) => c.quantity),
  );
  return (
    <Reveal className="deeds-card deeds-achievements" as="article">
      <header>
        <h3>{t("deeds.achievements")}</h3>
        <p className="deeds-big">
          <CountUp value={achievements.total} locale={locale} />
          <small>
            {t("deeds.points", {
              points: formatNumber(achievements.points, locale),
            })}
          </small>
        </p>
      </header>
      {achievements.recent.length > 0 ? (
        <ol className="deeds-timeline">
          {achievements.recent.map((event) => (
            <li key={event.id}>
              {event.iconUrl === undefined ? (
                <span className="deeds-shield" aria-hidden="true" />
              ) : (
                <AchievementIcon
                  className="deeds-achievement-icon"
                  iconUrl={event.iconUrl}
                  fallback={<span className="deeds-shield" />}
                />
              )}
              <AchievementHover
                achievement={event}
                className="deeds-event-name"
              >
                {event.name}
              </AchievementHover>
              <time dateTime={event.at}>{formatDate(event.at, locale)}</time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">{t("deeds.noAchievements")}</p>
      )}
      {achievements.categories.length > 0 ? (
        <ul className="deeds-categories">
          {achievements.categories.map((category) => (
            <li
              key={category.name}
              style={{
                ["--weight" as string]: String(category.quantity / biggest),
              }}
            >
              {category.name}
              <span>{category.quantity}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {achievements.inProgress.length > 0 ? (
        <details className="deeds-progress">
          <summary>
            {t("deeds.inProgress", { count: achievements.inProgress.length })}
          </summary>
          <ul>
            {achievements.inProgress.map((entry) => (
              <li key={entry.id}>
                <AchievementHover achievement={entry}>
                  {entry.name}
                </AchievementHover>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Reveal>
  );
}

function Statistics({ profile }: CharacterDeedsProps) {
  const { t, locale } = useLocale();
  const groups = profile.statisticGroups.filter(
    (group) => group.entries.length > 0,
  );
  const [active, setActive] = useState(groups[0]?.id);
  const baseId = useId();
  const current = groups.find((group) => group.id === active) ?? groups[0];
  if (!current) return null;
  return (
    <Reveal className="deeds-card deeds-statistics" as="article">
      <h3>{t("deeds.statistics")}</h3>
      <div
        className="stat-tabs"
        role="tablist"
        aria-label={t("deeds.statistics")}
      >
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${String(group.id)}`}
            aria-selected={group.id === current.id}
            aria-controls={`${baseId}-panel`}
            onClick={() => {
              setActive(group.id);
            }}
          >
            {group.name}
            <span>{group.entries.length}</span>
          </button>
        ))}
      </div>
      <div
        className="stat-panel"
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${String(current.id)}`}
        key={current.id}
      >
        <table>
          <tbody>
            {current.entries.map((entry, index) => (
              <tr key={`${entry.name}-${String(index)}`}>
                <th scope="row">
                  {entry.name}
                  {entry.detail ? <small>{entry.detail}</small> : null}
                </th>
                <td>{formatNumber(entry.quantity, locale)}</td>
                <td>
                  {entry.at ? (
                    <time dateTime={entry.at}>
                      {formatDate(entry.at, locale)}
                    </time>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  );
}

function Journey({ profile }: CharacterDeedsProps) {
  const { t, locale } = useLocale();
  const { quests, pvp, titles } = profile;
  return (
    <Reveal className="deeds-card deeds-journey" as="article">
      <h3>{t("deeds.journey")}</h3>
      <dl className="deeds-numbers">
        <div>
          <dt>{t("deeds.questsCompleted")}</dt>
          <dd>
            <CountUp value={quests.completedCount} locale={locale} />
          </dd>
        </div>
        <div>
          <dt>{t("deeds.questsActive")}</dt>
          <dd>
            <CountUp value={quests.inProgress.length} locale={locale} />
          </dd>
        </div>
        <div>
          <dt>{t("deeds.honorableKills")}</dt>
          <dd>
            <CountUp value={pvp?.honorableKills ?? 0} locale={locale} />
          </dd>
        </div>
        <div>
          <dt>{t("deeds.pvpRank")}</dt>
          <dd>{pvp?.rank ?? 0}</dd>
        </div>
      </dl>
      {quests.inProgress.length > 0 ? (
        <details className="deeds-quests" open>
          <summary>{t("deeds.questLog")}</summary>
          <ol className="quest-log">
            {quests.inProgress.map((quest) => (
              <li key={quest}>
                <span className="quest-mark" aria-hidden="true">
                  !
                </span>
                {quest}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {titles.length > 0 ? (
        <ul className="deeds-titles">
          {titles.map((title) => (
            <li key={title}>{title}</li>
          ))}
        </ul>
      ) : null}
    </Reveal>
  );
}

export function CharacterDeeds({ profile }: CharacterDeedsProps) {
  return (
    <div className="deeds">
      <Achievements profile={profile} />
      <Journey profile={profile} />
      <Statistics profile={profile} />
    </div>
  );
}
