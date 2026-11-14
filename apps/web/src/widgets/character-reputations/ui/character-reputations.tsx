import type { Reputation } from "@guildhub/contracts";
import { reputationColorVar } from "../../../entities/character";
import { Meter, Reveal } from "../../../shared/ui";

interface CharacterReputationsProps {
  readonly reputations: readonly Reputation[];
}

const progress = (reputation: Reputation) =>
  reputation.max > 0 ? reputation.value / reputation.max : 1;

export function CharacterReputations({
  reputations,
}: CharacterReputationsProps) {
  const ordered = [...reputations].sort(
    (left, right) => right.tier - left.tier || progress(right) - progress(left),
  );
  return (
    <ul className="reputation-list">
      {ordered.map((reputation, index) => (
        <Reveal
          key={reputation.factionId}
          as="li"
          className="reputation"
          delayMs={index * 50}
        >
          <Meter
            value={reputation.value}
            max={reputation.max}
            color={reputationColorVar(reputation.tier)}
            variant="frame"
            label={reputation.faction}
            detail={
              <>
                <span
                  className="reputation-standing"
                  style={{ color: reputationColorVar(reputation.tier) }}
                >
                  {reputation.standing}
                </span>{" "}
                {reputation.max > 0
                  ? `${String(reputation.value)} / ${String(reputation.max)}`
                  : ""}
              </>
            }
          />
        </Reveal>
      ))}
    </ul>
  );
}
