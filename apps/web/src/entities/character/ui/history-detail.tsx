import type { HistoryEvent } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import {
  achievementsKey,
  itemOfEvent,
  questsKey,
} from "../model/history-event";
import { ItemHover } from "./item-hover";
import { itemQualityColorVar } from "../model/item";
import { reputationColorVar } from "../model/vitals";

/** What happened, in words, after the member's name. */
export function HistoryDetail({ event }: { readonly event: HistoryEvent }) {
  const { t, locale } = useLocale();
  switch (event.kind) {
    case "item":
      return (
        <>
          <span>{t("history.event.item")} </span>
          <ItemHover item={itemOfEvent(event, t(`slot.${event.slot}`))}>
            <span
              className="history-item"
              style={{ color: itemQualityColorVar(event.quality) }}
            >
              [{event.item}]
            </span>
          </ItemHover>
          <span className="history-chips">
            <span className="history-chip">{t(`slot.${event.slot}`)}</span>
            {event.itemLevel === undefined || event.itemLevel <= 1 ? null : (
              <span className="history-chip">
                {t("history.itemLevel", { level: event.itemLevel })}
              </span>
            )}
          </span>
        </>
      );
    case "profession": {
      const max = event.maxSkill ?? 0;
      return (
        <>
          {t("history.event.profession", {
            profession: event.profession,
            skill: event.to,
          })}
          <span className="history-chip history-chip-gain">
            +{event.to - event.from}
          </span>
          {max > 0 ? (
            <span className="history-skill" aria-hidden="true">
              <span
                className="history-skill-before"
                style={{ width: `${String((event.from / max) * 100)}%` }}
              />
              <span
                className="history-skill-gain"
                style={{
                  left: `${String((event.from / max) * 100)}%`,
                  width: `${String(((event.to - event.from) / max) * 100)}%`,
                }}
              />
            </span>
          ) : null}
        </>
      );
    }
    case "reputation":
      return (
        <>
          {t("history.event.reputationBefore", { faction: event.faction })}{" "}
          <span
            className="history-standing"
            style={{ ["--standing" as string]: reputationColorVar(event.tier) }}
          >
            {event.standing}
          </span>{" "}
          {t("history.event.reputationAfter", { faction: event.faction })}
        </>
      );
    case "achievements":
      return (
        <>
          {t(achievementsKey(event), {
            count: formatNumber(event.count, locale),
            points: formatNumber(event.points, locale),
          })}
        </>
      );
    case "rank":
      return (
        <>{t("history.event.rank", { rank: t(`rank.${String(event.to)}`) })}</>
      );
    case "mount":
      return (
        <>
          {t("history.event.mountShort")}{" "}
          <span className="history-mount">{event.mount}</span>
        </>
      );
    case "quests":
      return (
        <>
          {t(questsKey(event), {
            count: formatNumber(event.to - event.from, locale),
          })}
          <span className="history-chip">
            {t("history.questsTotal", {
              total: formatNumber(event.to, locale),
            })}
          </span>
        </>
      );
    case "achievement":
      return (
        <>
          {t("history.event.achievementNamed")}{" "}
          <strong className="history-achievement">[{event.achievement}]</strong>
        </>
      );
    case "level":
      return <>{t("history.event.level", { level: event.to })}</>;
    case "joined":
    case "left":
      return <>{t(`history.event.${event.kind}`)}</>;
  }
}
