import type { CharacterDetailResponse } from "@guildhub/contracts";
import {
  ClassColoredName,
  ClassMark,
  RaceMark,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";

interface CharacterProfileProps {
  readonly character: CharacterDetailResponse;
}

export function CharacterProfile({ character }: CharacterProfileProps) {
  const { t } = useLocale();
  return (
    <section
      className="character-profile"
      style={{ ["--row-class" as string]: wowClassColorVar(character.classId) }}
    >
      <header>
        <p className="eyebrow">{t(`rank.${String(character.rankId)}`)}</p>
        <h1 className="reveal-name">
          <ClassColoredName classId={character.classId}>
            {character.name}
          </ClassColoredName>
        </h1>
        <p className="character-surname">{character.surname}</p>
      </header>
      <dl className="character-facts">
        <div>
          <dt>{t("members.level")}</dt>
          <dd className="roster-level">{character.level}</dd>
        </div>
        <div>
          <dt>{t("members.class")}</dt>
          <dd>
            <span className="wow-badge">
              <ClassMark classId={character.classId} />
              <ClassColoredName classId={character.classId}>
                {t(`class.${character.classId}`)}
              </ClassColoredName>
            </span>
          </dd>
        </div>
        <div>
          <dt>{t("members.race")}</dt>
          <dd>
            <span className="wow-badge">
              <RaceMark raceId={character.raceId} />
              <span>{t(`race.${character.raceId}`)}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt>{t("members.rank")}</dt>
          <dd>{t(`rank.${String(character.rankId)}`)}</dd>
        </div>
      </dl>
      <section className="character-placeholder">
        <h2>{t("character.placeholderTitle")}</h2>
        <p>{t("character.placeholderBody")}</p>
      </section>
    </section>
  );
}
