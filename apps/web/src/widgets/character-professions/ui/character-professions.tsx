import type { Profession } from "@guildhub/contracts";
import { SkillScale, SkillTrack } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";

interface CharacterProfessionsProps {
  readonly professions: readonly Profession[];
}

export function CharacterProfessions({
  professions,
}: CharacterProfessionsProps) {
  const { t } = useLocale();
  const ordered = [...professions].sort(
    (left, right) =>
      Number(left.kind === "secondary") - Number(right.kind === "secondary") ||
      right.skill - left.skill,
  );
  return (
    <ul className="profession-grid">
      {ordered.map((profession, index) => {
        const recipes = [...new Set(profession.recipes)];
        return (
          <Reveal
            key={profession.id}
            as="li"
            className="profession-card"
            delayMs={index * 70}
          >
            <div className="profession-head">
              <span className="profession-glyph" aria-hidden="true">
                {profession.name.slice(0, 1)}
              </span>
              <div>
                <h3>{profession.name}</h3>
                <p className="eyebrow">{t(`profession.${profession.kind}`)}</p>
              </div>
            </div>
            <SkillScale />
            <SkillTrack
              skill={profession.skill}
              maxSkill={profession.maxSkill}
              color={
                profession.kind === "primary"
                  ? "var(--color-gold)"
                  : "var(--color-signal)"
              }
              label={t("profession.skill")}
            />
            {recipes.length > 0 ? (
              <details className="profession-recipes">
                <summary>
                  {t("profession.recipes", { count: recipes.length })}
                </summary>
                <ul>
                  {recipes.map((recipe) => (
                    <li key={recipe}>{recipe}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Reveal>
        );
      })}
    </ul>
  );
}
