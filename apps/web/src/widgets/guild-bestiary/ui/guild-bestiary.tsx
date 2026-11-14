import type { GuildChronicleResponse } from "@guildhub/contracts";
import { CharacterLink } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { CountUp, Reveal } from "../../../shared/ui";

interface GuildBestiaryProps {
  readonly bestiary: GuildChronicleResponse["bestiary"];
}

export function GuildBestiary({ bestiary }: GuildBestiaryProps) {
  const { t, locale } = useLocale();
  if (bestiary.length === 0) {
    return <p className="muted">{t("bestiary.empty")}</p>;
  }
  return (
    <ul className="bestiary">
      {bestiary.map((entry, index) => (
        <Reveal
          key={`${entry.boss}-${entry.place ?? ""}`}
          as="li"
          className="boss-card"
          delayMs={index * 90}
        >
          <div className="boss-sigil" aria-hidden="true">
            <span>{entry.boss.slice(0, 1)}</span>
          </div>
          <div className="boss-body">
            {entry.place ? <p className="eyebrow">{entry.place}</p> : null}
            <h3>{entry.boss}</h3>
            <p className="boss-kills">
              <CountUp value={entry.kills} locale={locale} />
              <span>{t("bestiary.kills")}</span>
            </p>
            <p className="boss-slayers">
              {t("bestiary.slainBy")}{" "}
              {entry.slayers.map((slayer, slayerIndex) => (
                <span key={slayer.slug}>
                  {slayerIndex > 0 ? ", " : ""}
                  <CharacterLink
                    slug={slayer.slug}
                    classId={slayer.classId}
                    title={`${slayer.name} ${slayer.surname}`}
                  >
                    {slayer.name}
                  </CharacterLink>
                </span>
              ))}
            </p>
          </div>
        </Reveal>
      ))}
    </ul>
  );
}
