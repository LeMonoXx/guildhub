import type { CharacterStatistics } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { CountUp, Meter, Reveal } from "../../../shared/ui";

interface CharacterAttributesProps {
  readonly statistics: CharacterStatistics;
}

interface Line {
  readonly key: string;
  readonly value: number;
  readonly digits?: number;
  readonly suffix?: string;
}

function StatCard({
  title,
  lines,
  delayMs,
}: {
  readonly title: string;
  readonly lines: readonly Line[];
  readonly delayMs: number;
}) {
  const { t, locale } = useLocale();
  return (
    <Reveal className="stat-card" delayMs={delayMs}>
      <h3>{title}</h3>
      <dl>
        {lines.map((line) => (
          <div key={line.key}>
            <dt>{t(`stat.${line.key}`)}</dt>
            <dd>
              {formatNumber(line.value, locale, line.digits ?? 0)}
              {line.suffix ?? ""}
            </dd>
          </div>
        ))}
      </dl>
    </Reveal>
  );
}

export function CharacterAttributes({ statistics }: CharacterAttributesProps) {
  const { t, locale } = useLocale();
  const strongest = Math.max(
    1,
    ...statistics.primary.map((stat) => stat.effective),
  );
  const mainHand = statistics.melee.mainHand;
  const offHand = statistics.melee.offHand;
  const melee: Line[] = [
    { key: "attackPower", value: statistics.melee.attackPower },
    { key: "crit", value: statistics.melee.crit, digits: 2, suffix: "%" },
    { key: "hit", value: statistics.melee.hit, digits: 0, suffix: "%" },
    ...(mainHand
      ? [
          { key: "mainHandDps", value: mainHand.dps, digits: 1 },
          { key: "mainHandSpeed", value: mainHand.speed, digits: 2 },
        ]
      : []),
    ...(offHand && offHand.dps > 2
      ? [{ key: "offHandDps", value: offHand.dps, digits: 1 }]
      : []),
  ];
  const ranged: Line[] = [
    { key: "attackPower", value: statistics.ranged.attackPower },
    { key: "crit", value: statistics.ranged.crit, digits: 2, suffix: "%" },
    { key: "hit", value: statistics.ranged.hit, suffix: "%" },
    { key: "damageMin", value: statistics.ranged.min },
    { key: "damageMax", value: statistics.ranged.max },
  ];
  const spell: Line[] = [
    { key: "spellPower", value: statistics.spell.power },
    { key: "healing", value: statistics.spell.healing },
    { key: "crit", value: statistics.spell.crit, digits: 2, suffix: "%" },
    { key: "hit", value: statistics.spell.hit, suffix: "%" },
    { key: "manaRegen", value: statistics.spell.manaRegen },
    { key: "manaRegenCombat", value: statistics.spell.manaRegenCombat },
  ];
  const defense: Line[] = [
    ...(statistics.armor
      ? [{ key: "armor", value: statistics.armor.effective }]
      : []),
    ...(statistics.defense
      ? [{ key: "defense", value: statistics.defense.effective }]
      : []),
    { key: "dodge", value: statistics.defenses.dodge, digits: 2, suffix: "%" },
    { key: "parry", value: statistics.defenses.parry, digits: 2, suffix: "%" },
    { key: "block", value: statistics.defenses.block, digits: 2, suffix: "%" },
  ];

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
