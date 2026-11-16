import { useLocale } from "../../../shared/i18n";
import { professionScale, professionTiers } from "../model/profession-tiers";
import { skillMarkAt } from "../model/skill-marks";

/** Rank names above a group of skill tracks, aligned with their ticks. */
export function SkillScale() {
  const { t } = useLocale();
  return (
    <div className="skill-scale" aria-hidden="true">
      {professionTiers.map((entry) => (
        <span
          key={entry.tier}
          title={t(`profession.tier.${entry.tier}`)}
          style={{ left: skillMarkAt(entry.cap, professionScale) }}
        >
          {entry.cap}
        </span>
      ))}
    </div>
  );
}
