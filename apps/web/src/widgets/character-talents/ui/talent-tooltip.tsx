import type { TalentNode, TalentTree } from "@guildhub/contracts";

import { useLocale } from "../../../shared/i18n";
import { prerequisitesOf, rowRequirement } from "../model/talent-grid";

interface TalentTooltipProps {
  readonly node: TalentNode;
  readonly tree: TalentTree;
  readonly id: string;
}

/** The in-game talent tooltip: rank, what it does now, what the next rank adds, what it needs. */
export function TalentTooltip({ node, tree, id }: TalentTooltipProps) {
  const { t } = useLocale();
  const needsPoints = tree.spentPoints < rowRequirement(node.row);
  const missing = prerequisitesOf(node, tree).filter(
    (required) => required.rank < required.maxRank,
  );
  return (
    <div className="wow-tooltip talent-tooltip" role="tooltip" id={id}>
      <p className="wow-tooltip-name">{node.name}</p>
      <p className="talent-tooltip-rank">
        {t("talents.rankOf", { rank: node.rank, max: node.maxRank })}
      </p>
      {node.castTime ? (
        <p className="talent-tooltip-cast">{node.castTime}</p>
      ) : null}
      {needsPoints ? (
        <p className="talent-tooltip-requirement">
          {t("talents.requiresPoints", {
            points: rowRequirement(node.row),
            tree: tree.name,
          })}
        </p>
      ) : null}
      {missing.map((required) => (
        <p key={required.id} className="talent-tooltip-requirement">
          {t("talents.requiresTalent", {
            points: required.maxRank,
            name: required.name,
          })}
        </p>
      ))}
      {node.description ? (
        <p className="talent-tooltip-description">{node.description}</p>
      ) : null}
      {node.nextDescription ? (
        <>
          <p className="talent-tooltip-next-label">{t("talents.nextRank")}</p>
          <p className="talent-tooltip-description">{node.nextDescription}</p>
        </>
      ) : null}
    </div>
  );
}
