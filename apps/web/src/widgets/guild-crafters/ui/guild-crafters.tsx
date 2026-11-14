import type { GuildChronicleResponse } from "@guildhub/contracts";
import {
  bySkill,
  CharacterLink,
  SkillScale,
  SkillTrack,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";

interface GuildCraftersProps {
  readonly professions: GuildChronicleResponse["professions"];
}

export function GuildCrafters({ professions }: GuildCraftersProps) {
  const { t } = useLocale();
  if (professions.length === 0) {
    return <p className="muted">{t("crafters.empty")}</p>;
  }
  return (
    <ul className="crafter-grid">
      {professions.map((profession, index) => (
        <Reveal
          key={profession.name}
          as="li"
          className="crafter-card"
          delayMs={(index % 6) * 60}
        >
          <header>
            <span className="profession-glyph" aria-hidden="true">
              {profession.name.slice(0, 1)}
            </span>
            <h3>{profession.name}</h3>
            <span className="crafter-count">
              {t("crafters.count", { count: profession.crafters.length })}
            </span>
          </header>
          <SkillScale />
          <ul>
            {[...profession.crafters].sort(bySkill).map((crafter) => (
              <li key={crafter.slug}>
                <SkillTrack
                  skill={crafter.skill}
                  maxSkill={crafter.maxSkill}
                  label={
                    <CharacterLink
                      slug={crafter.slug}
                      classId={crafter.classId}
                      title={`${crafter.name} ${crafter.surname}`}
                    >
                      {crafter.name}
                    </CharacterLink>
                  }
                />
              </li>
            ))}
          </ul>
        </Reveal>
      ))}
    </ul>
  );
}
