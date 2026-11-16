import type { CharacterProfileResponse } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { CountUp, Reveal } from "../../../shared/ui";
import { QuestCard } from "./quest-card";
import { QuestLink } from "./quest-link";

export function DeedsJourney({
  profile,
}: {
  readonly profile: Pick<CharacterProfileResponse, "quests" | "pvp" | "titles">;
}) {
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
        <div className="quest-log">
          <h4>{t("deeds.questLog")}</h4>
          {quests.inProgress.map((quest, index) => (
            <QuestCard key={quest.id} quest={quest} open={index === 0} />
          ))}
        </div>
      ) : null}
      {quests.recentCompleted.length > 0 ? (
        <div className="quest-completed">
          <h4>{t("deeds.questsFinished")}</h4>
          <ul>
            {quests.recentCompleted.map((quest) => (
              <li key={quest.id}>
                <QuestLink quest={quest}>{quest.name}</QuestLink>
              </li>
            ))}
          </ul>
        </div>
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
