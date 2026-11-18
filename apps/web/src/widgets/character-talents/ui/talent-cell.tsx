import type { TalentNode, TalentTree } from "@guildhub/contracts";
import { useId } from "react";
import { FallbackImage } from "../../../shared/ui";
import { talentState } from "../model/talent-grid";
import { TalentTooltip } from "./talent-tooltip";

export function TalentCell({
  node,
  tree,
}: {
  readonly node: TalentNode;
  readonly tree: TalentTree;
}) {
  const tooltipId = useId();
  const state = talentState(node, tree);
  return (
    <li
      className="talent-cell"
      data-state={state}
      style={{ gridRow: node.row, gridColumn: node.column }}
    >
      <button
        type="button"
        className="talent-cell-button"
        aria-describedby={tooltipId}
      >
        <span className="talent-cell-icon">
          <FallbackImage
            src={node.iconUrl}
            fallback={<span aria-hidden="true">?</span>}
            alt=""
            loading="lazy"
          />
        </span>
        <span className="talent-cell-rank" aria-hidden="true">
          {node.rank}/{node.maxRank}
        </span>
        <span className="talent-cell-tip">
          <TalentTooltip node={node} tree={tree} id={tooltipId} />
        </span>
      </button>
    </li>
  );
}
