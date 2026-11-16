import type { Specialization, TalentTree } from "@guildhub/contracts";
import { SpentTalentList } from "./spent-talent-list";
import { TalentBoard } from "./talent-board";

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
