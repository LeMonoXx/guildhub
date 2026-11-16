import type { TalentTree } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";
import { leadingTree, pointSplit } from "../model/talent-grid";
import { TalentTreePanel } from "./talent-tree-panel";

/** The class's three classic trees side by side. */
export function TalentBoard({
  trees,
}: {
  readonly trees: readonly TalentTree[];
}) {
  const { t } = useLocale();
  const leading = leadingTree(trees);
  const total = trees.reduce((sum, tree) => sum + tree.spentPoints, 0);
  return (
    <>
      {leading && total > 0 ? (
        <Reveal className="talent-split">
          <p className="talent-split-numbers">{pointSplit(trees)}</p>
          <p>{t("talents.leading", { tree: leading.name, points: total })}</p>
        </Reveal>
      ) : null}
      <div className="talent-board">
        {trees.map((tree, index) => (
          <Reveal key={tree.specId} delayMs={index * 120}>
            <TalentTreePanel tree={tree} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
