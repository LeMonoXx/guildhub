import type { QuestLogEntry, QuestRef } from "@guildhub/contracts";
import { useState } from "react";
import { Money } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber, wowheadUrl } from "../../../shared/lib";

export function QuestCard({
  quest,
  open,
}: {
  readonly quest: QuestLogEntry;
  readonly open: boolean;
}) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = useState(open);
  return (
    <details
      className="quest-card"
      open={expanded}
      onToggle={(event) => {
        setExpanded(event.currentTarget.open);
      }}
    >
      <summary>
        <span className="quest-mark" aria-hidden="true">
          !
        </span>
        <span>
          <strong>{quest.name}</strong>
          {quest.area === undefined ? null : <small>{quest.area}</small>}
        </span>
      </summary>
      {quest.description === undefined ? null : <p>{quest.description}</p>}
      <ul className="quest-facts">
        {quest.minLevel === undefined ? null : (
          <li>{t("deeds.questLevel", { level: quest.minLevel })}</li>
        )}
        {quest.cadence === undefined ? null : (
          <li>{t(`deeds.questCadence.${quest.cadence}`)}</li>
        )}
        {quest.experience === undefined ? null : (
          <li>
            {t("deeds.questExperience", {
              value: formatNumber(quest.experience, locale),
            })}
          </li>
        )}
        {quest.moneyCopper === undefined ? null : (
          <li>
            <Money copper={quest.moneyCopper} />
          </li>
        )}
        {quest.itemRewards?.map((item, index) => (
          <li key={`${item}-${String(index)}`}>{item}</li>
        ))}
      </ul>
      <QuestLink quest={quest}>{t("deeds.questWowhead")}</QuestLink>
    </details>
  );
}

export function QuestLink({
  quest,
  children,
}: {
  readonly quest: QuestRef;
  readonly children: string;
}) {
  const { locale } = useLocale();
  return (
    <a
      className="quest-link"
      href={wowheadUrl("quest", quest.id, locale)}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
