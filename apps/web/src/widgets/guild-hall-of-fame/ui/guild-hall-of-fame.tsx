import type { GuildChronicleResponse } from "@guildhub/contracts";
import { CharacterLink, wowClassColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { CountUp, Reveal } from "../../../shared/ui";

interface GuildHallOfFameProps {
  readonly hallOfFame: GuildChronicleResponse["hallOfFame"];
}

export function GuildHallOfFame({ hallOfFame }: GuildHallOfFameProps) {
  const { t, locale } = useLocale();
  return (
    <ul className="hall-of-fame">
      {hallOfFame.map((champion, index) => (
        <Reveal
          key={champion.category}
          as="li"
          className="champion"
          delayMs={index * 80}
        >
          <div
            className="champion-card"
            style={{
              ["--champion-class" as string]: wowClassColorVar(
                champion.classId,
              ),
            }}
          >
            <span className="champion-crown" aria-hidden="true" />
            <p className="eyebrow">{t(`fame.${champion.category}`)}</p>
            <p className="champion-value">
              <CountUp
                value={champion.value}
                locale={locale}
                fractionDigits={champion.category === "itemLevel" ? 1 : 0}
              />
            </p>
            <CharacterLink
              slug={champion.slug}
              classId={champion.classId}
              className="champion-name"
            >
              {champion.name}
            </CharacterLink>
            <span className="champion-surname">{champion.surname}</span>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}
