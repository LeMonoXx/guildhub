import type { TalentNode, TalentTree } from "@guildhub/contracts";
import { useId, type CSSProperties } from "react";

import { useLocale } from "../../../shared/i18n";
import { FallbackImage } from "../../../shared/ui";
import { talentArrows, talentState } from "../model/talent-grid";
import { TalentTooltip } from "./talent-tooltip";

interface TalentTreePanelProps {
  readonly tree: TalentTree;
}

function TalentCell({
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
      <span
        className="talent-cell-button"
        tabIndex={0}
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
      </span>
    </li>
  );
}

/** One classic talent tree: the grid, prerequisite arrows, and the points spent. */
export function TalentTreePanel({ tree }: TalentTreePanelProps) {
  const { t } = useLocale();
  const arrows = talentArrows(tree);
  return (
    <article
      className="talent-panel"
      data-empty={tree.spentPoints === 0}
      style={
        {
          "--talent-rows": tree.rows,
          "--talent-columns": tree.columns,
        } as CSSProperties
      }
    >
      <header className="talent-panel-head">
        <span className="talent-panel-icon" aria-hidden="true">
          <FallbackImage
            src={tree.iconUrl}
            fallback={null}
            alt=""
            loading="lazy"
          />
        </span>
        <h3>{tree.name}</h3>
        <span className="talent-panel-points">
          {t("talents.points", { points: tree.spentPoints })}
        </span>
      </header>
      <div className="talent-panel-board">
        {tree.iconUrl ? (
          <img
            className="talent-panel-backdrop"
            src={tree.iconUrl}
            alt=""
            aria-hidden="true"
          />
        ) : null}
        <svg
          className="talent-panel-arrows"
          viewBox={`0 0 ${String(tree.columns)} ${String(tree.rows)}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {arrows.map((arrow) => (
            <path
              key={arrow.id}
              d={arrow.path}
              data-met={arrow.met}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
        <ol className="talent-grid" aria-label={tree.name}>
          {tree.nodes.map((node) => (
            <TalentCell key={node.id} node={node} tree={tree} />
          ))}
        </ol>
      </div>
    </article>
  );
}
