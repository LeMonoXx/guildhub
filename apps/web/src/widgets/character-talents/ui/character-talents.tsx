import type { Specialization, TalentTree } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { wowheadUrl } from "../../../shared/lib";
import { Meter, Reveal } from "../../../shared/ui";
import { leadingTree, pointSplit } from "../model/talent-grid";
import { TalentTreePanel } from "./talent-tree-panel";

interface CharacterTalentsProps {
  readonly specializations: readonly Specialization[];
  readonly talentTrees?: readonly TalentTree[] | undefined;
  readonly classColor: string;
}

export function CharacterTalents({
  specializations,
  talentTrees,
  classColor,
}: CharacterTalentsProps) {
  return (
    <div
      className="talents"
      style={{ ["--talent-color" as string]: classColor }}
    >
      {talentTrees && talentTrees.length > 0 ? (
        <TalentBoard trees={talentTrees} />
      ) : (
        <SpentTalentList specializations={specializations} />
      )}
    </div>
  );
}

/** The class's three classic trees side by side. */
function TalentBoard({ trees }: { readonly trees: readonly TalentTree[] }) {
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

/** Before the trees are known: just the learned talents per specialization. */
function SpentTalentList({
  specializations,
}: {
  readonly specializations: readonly Specialization[];
}) {
  const { t, locale } = useLocale();
  const total = specializations.reduce(
    (sum, spec) => sum + spec.spentPoints,
    0,
  );
  const ordered = [...specializations].sort(
    (left, right) => right.spentPoints - left.spentPoints,
  );
  const leading = ordered[0];

  return (
    <>
      {leading ? (
        <Reveal className="talent-split">
          <p className="talent-split-numbers">
            {specializations
              .map((spec) => String(spec.spentPoints))
              .join(" / ")}
          </p>
          <p>{t("talents.leading", { tree: leading.name, points: total })}</p>
        </Reveal>
      ) : null}
      <div className="talent-trees">
        {ordered.map((spec, treeIndex) => (
          <Reveal
            key={spec.id}
            className="talent-tree"
            delayMs={treeIndex * 120}
            as="article"
          >
            <header>
              <h3>{spec.name}</h3>
              <Meter
                value={spec.spentPoints}
                max={Math.max(total, 1)}
                color="var(--talent-color)"
                detail={t("talents.points", { points: spec.spentPoints })}
              />
            </header>
            {spec.talents.length === 0 ? (
              <p className="muted">{t("talents.none")}</p>
            ) : (
              <ul>
                {spec.talents.map((talent) => (
                  <li key={talent.name} className="talent">
                    <div className="talent-head">
                      <span className="talent-name">{talent.name}</span>
                      <span
                        className="talent-pips"
                        aria-label={t("talents.rank", { rank: talent.rank })}
                      >
                        {Array.from({ length: talent.rank }, (_, index) => (
                          <span key={index} className="talent-pip" />
                        ))}
                      </span>
                    </div>
                    {talent.castTime ? (
                      <span className="talent-cast">{talent.castTime}</span>
                    ) : null}
                    {talent.description ? (
                      <p className="talent-description">{talent.description}</p>
                    ) : null}
                    {talent.spellId ? (
                      <a
                        className="talent-link"
                        href={wowheadUrl("spell", talent.spellId, locale)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("talents.spell", { id: talent.spellId })}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        ))}
      </div>
    </>
  );
}
