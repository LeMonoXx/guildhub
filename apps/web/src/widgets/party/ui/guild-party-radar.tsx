import type { GuildPartyResponse } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";
import { membersBySlug, readyDungeons } from "../model/party-lookup";
import { DungeonCard } from "./dungeon-card";
import { QuestCard } from "./quest-card";

const QUEST_LIMIT = 6;
const DUNGEON_LIMIT = 4;

/** The guild page's look at who could team up right now. */
export function GuildPartyRadar({
  party,
}: {
  readonly party: GuildPartyResponse;
}) {
  const { t } = useLocale();
  const members = membersBySlug(party);
  const quests = party.quests.slice(0, QUEST_LIMIT);
  const dungeons = readyDungeons(party.dungeons).slice(0, DUNGEON_LIMIT);
  return (
    <div className="party-radar">
      <section className="party-column" aria-labelledby="party-quests">
        <h3 id="party-quests" className="party-column-title">
          {t("party.sharedQuests")}
        </h3>
        {quests.length === 0 ? (
          <p className="muted">{t("party.noSharedQuests")}</p>
        ) : (
          <ul className="party-list">
            {quests.map((quest, index) => (
              <Reveal key={quest.id} as="li" delayMs={index * 70}>
                <QuestCard quest={quest} members={members} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>
      <section className="party-column" aria-labelledby="party-dungeons">
        <h3 id="party-dungeons" className="party-column-title">
          {t("party.dungeons")}
        </h3>
        {dungeons.length === 0 ? (
          <p className="muted">{t("party.noDungeons")}</p>
        ) : (
          <ul className="party-list">
            {dungeons.map((dungeon, index) => (
              <Reveal key={dungeon.key} as="li" delayMs={index * 90}>
                <DungeonCard dungeon={dungeon} members={members} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>
      <Link to="/party" className="button button-primary party-cta">
        {t("party.toMap")}
      </Link>
    </div>
  );
}
