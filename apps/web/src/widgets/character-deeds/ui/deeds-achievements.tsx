import type { CharacterProfileResponse } from "@guildhub/contracts";
import { AchievementHover, AchievementIcon } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatDate, formatNumber } from "../../../shared/lib";
import { CountUp, Reveal } from "../../../shared/ui";

export function DeedsAchievements({
  achievements,
}: {
  readonly achievements: CharacterProfileResponse["achievements"];
}) {
  const { t, locale } = useLocale();
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
