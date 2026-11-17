import type { GuildPartyResponse, PartyMember } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { sameSpotlight, type MapSpotlight } from "../model/map-scene";
import { readyDungeons } from "../model/party-lookup";
import { DungeonCard } from "./dungeon-card";
import { QuestCard } from "./quest-card";
import type { Spotlight } from "./spotlight-title";

interface MapPanelProps {
  readonly party: GuildPartyResponse;
  readonly members: ReadonlyMap<string, PartyMember>;
  readonly spotlight: MapSpotlight | undefined;
  readonly onHover: (spotlight: MapSpotlight | undefined) => void;
  readonly onSelect: (spotlight: MapSpotlight) => void;
}

/** The lists beside the map; each card lights its people up on the map. */
export function MapPanel({
  party,
  members,
  spotlight,
  onHover,
  onSelect,
}: MapPanelProps) {
  const { t } = useLocale();
  const spot = (target: MapSpotlight): Spotlight => ({
    active: sameSpotlight(spotlight, target),
    onHover: (on) => {
      onHover(on ? target : undefined);
    },
    onSelect: () => {
      onSelect(target);
    },
  });
  const dungeons = readyDungeons(party.dungeons);
  return (
    <aside className="party-map-panel" aria-label={t("party.panelLabel")}>
      <section aria-labelledby="party-panel-quests">
        <h2 id="party-panel-quests" className="party-column-title">
          {t("party.sharedQuests")}
        </h2>
        {party.quests.length === 0 ? (
          <p className="muted">{t("party.noSharedQuests")}</p>
        ) : (
          <ul className="party-list">
            {party.quests.map((quest) => (
              <li key={quest.id}>
                <QuestCard
                  quest={quest}
                  members={members}
                  spotlight={spot({ kind: "quest", id: quest.id })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="party-panel-dungeons">
        <h2 id="party-panel-dungeons" className="party-column-title">
          {t("party.dungeons")}
        </h2>
        {dungeons.length === 0 ? (
          <p className="muted">{t("party.noDungeons")}</p>
        ) : (
          <ul className="party-list">
            {dungeons.map((dungeon) => (
              <li key={dungeon.key}>
                <DungeonCard
                  dungeon={dungeon}
                  members={members}
                  spotlight={spot({ kind: "dungeon", key: dungeon.key })}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
