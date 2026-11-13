import type { CharacterDetailResponse } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";

interface CharacterProfileProps {
  readonly character: CharacterDetailResponse;
}

export function CharacterProfile({ character }: CharacterProfileProps) {
  const { t } = useLocale();
  return (
    <section className="character-profile">
      <header>
        <p className="eyebrow">{t(`rank.${String(character.rankId)}`)}</p>
        <h1 className="reveal-name">{character.name}</h1>
        <p className="character-surname">{character.surname}</p>
      </header>
      <dl className="character-facts">
        <div>
          <dt>{t("members.level")}</dt>
          <dd>{character.level}</dd>
        </div>
        <div>
          <dt>{t("members.class")}</dt>
          <dd>{t(`class.${character.classId}`)}</dd>
        </div>
        <div>
          <dt>{t("members.race")}</dt>
          <dd>{t(`race.${character.raceId}`)}</dd>
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
