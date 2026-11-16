import type { CharacterStatistics } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { CountUp, Meter, Reveal } from "../../../shared/ui";
import { statGroups } from "../model/stat-lines";
import { StatCard } from "./stat-card";

interface CharacterAttributesProps {
  readonly statistics: CharacterStatistics;
}

export function CharacterAttributes({ statistics }: CharacterAttributesProps) {
  const { t, locale } = useLocale();
  const strongest = Math.max(
    1,
    ...statistics.primary.map((stat) => stat.effective),
  );
  const { melee, ranged, spell, defense } = statGroups(statistics);

  return (
    <div className="attributes">
      <Reveal className="attribute-primary">
        <ul>
          {statistics.primary.map((stat, index) => {
            const bonus = stat.effective - stat.base;
            return (
              <li
                key={stat.type}
                className="attribute-row"
                style={{ ["--row-delay" as string]: `${String(index * 70)}ms` }}
              >
                <span
                  className={`attribute-glyph attribute-${stat.type}`}
                  aria-hidden="true"
                >
                  {t(`attribute.${stat.type}`).slice(0, 3)}
                </span>
                <Meter
                  value={stat.effective}
                  max={strongest}
                  color={`var(--attribute-${stat.type}, var(--color-gold))`}
                  label={t(`attribute.${stat.type}`)}
                  detail={
                    <>
                      <CountUp value={stat.effective} locale={locale} />
                      {bonus > 0 ? (
                        <span className="stat-bonus">
                          {" "}
                          ({stat.base} +{bonus})
                        </span>
                      ) : null}
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      </Reveal>
      <div className="stat-cards">
        <StatCard title={t("stat.group.melee")} lines={melee} delayMs={0} />
        <StatCard title={t("stat.group.ranged")} lines={ranged} delayMs={80} />
        <StatCard title={t("stat.group.spell")} lines={spell} delayMs={160} />
        <StatCard
          title={t("stat.group.defense")}
          lines={defense}
          delayMs={240}
        />
      </div>
      <Reveal className="resistances">
        <h3>{t("stat.group.resistances")}</h3>
        <ul>
          {statistics.resistances.map((resistance) => (
            <li
              key={resistance.school}
              className="resistance-orb"
              data-school={resistance.school}
              data-active={resistance.effective > 0}
            >
              <span className="resistance-value">{resistance.effective}</span>
              <span className="resistance-name">
                {t(`school.${resistance.school}`)}
              </span>
            </li>
          ))}
        </ul>
        {statistics.movementSpeed === undefined ? null : (
          <p className="movement-speed">
            {t("stat.movementSpeed", { value: statistics.movementSpeed })}
          </p>
        )}
      </Reveal>
    </div>
  );
}
