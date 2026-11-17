import type { GuildPartyResponse } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";
import { dungeonsFor, membersBySlug, questsWith } from "../model/party-lookup";
import { DungeonCard } from "./dungeon-card";
import { QuestCard } from "./quest-card";

const DUNGEON_LIMIT = 3;

/** Who this member could quest or run a dungeon with right now. */
export function CharacterPartyRadar({
  party,
  slug,
}: {
  readonly party: GuildPartyResponse;
  readonly slug: string;
}) {
  const { t } = useLocale();
  const members = membersBySlug(party);
  const quests = questsWith(party, slug);
  const dungeons = dungeonsFor(party, slug).slice(0, DUNGEON_LIMIT);
  return (
    <div className="party-radar">
      <section className="party-column" aria-labelledby="party-own-quests">
        <h3 id="party-own-quests" className="party-column-title">
          {t("party.questPartners")}
        </h3>
        {quests.length === 0 ? (
          <p className="muted">{t("party.noQuestPartners")}</p>
        ) : (
          <ul className="party-list">
            {quests.map((quest, index) => (
              <Reveal key={quest.id} as="li" delayMs={index * 70}>
                <QuestCard quest={quest} members={members} self={slug} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>
      <section className="party-column" aria-labelledby="party-own-dungeons">
        <h3 id="party-own-dungeons" className="party-column-title">
          {t("party.ownDungeons")}
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
