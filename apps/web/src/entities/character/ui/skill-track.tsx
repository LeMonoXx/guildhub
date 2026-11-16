import type { ReactNode } from "react";
import { useLocale } from "../../../shared/i18n";
import { useInView } from "../../../shared/lib";
import {
  professionScale,
  professionTiers,
  tierOf,
} from "../model/profession-tiers";
import { skillMarkAt, skillShare } from "../model/skill-marks";

interface SkillTrackProps {
  readonly skill: number;
  readonly maxSkill: number;
  readonly label: ReactNode;
  readonly color?: string | undefined;
}

/**
 * A profession bar on one fixed scale for everybody, so equal skill always
 * means equal length; the part beyond the trained cap is shown as locked.
 */
export function SkillTrack({ skill, maxSkill, label, color }: SkillTrackProps) {
  const { t } = useLocale();
  const [ref, visible] = useInView<HTMLDivElement>();
  const scale = Math.max(professionScale, maxSkill);
  const tier = tierOf(maxSkill);
  return (
    <div
      ref={ref}
      className="skill-track"
      data-visible={visible}
      data-capped={skill >= maxSkill && maxSkill < scale}
      style={{
        ["--skill-fill" as string]: String(skillShare(skill, scale)),
        ["--skill-unlocked" as string]: String(skillShare(maxSkill, scale)),
        ["--meter-color" as string]: color ?? "var(--color-gold)",
      }}
    >
      <div className="meter-labels">
        <span>{label}</span>
        <span>
          {tier ? (
            <span className="skill-track-tier">
              {t(`profession.tier.${tier}`)}
            </span>
          ) : null}
          {`${String(skill)} / ${String(maxSkill)}`}
        </span>
      </div>
      <div
        className="skill-track-bar"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={maxSkill}
        aria-valuenow={skill}
      >
        <div className="skill-track-unlocked" />
        <div className="skill-track-fill" />
        {professionTiers.slice(0, -1).map((entry) => (
          <span
            key={entry.tier}
            className="skill-track-tick"
            data-unlocked={entry.cap <= maxSkill}
            style={{ left: skillMarkAt(entry.cap, scale) }}
          />
        ))}
        <span className="skill-track-cap" />
      </div>
    </div>
  );
}
