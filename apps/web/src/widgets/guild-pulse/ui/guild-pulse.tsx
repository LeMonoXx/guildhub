import type { GuildChronicleResponse } from "@guildhub/contracts";
import { useLocale } from "../../../shared/i18n";
import { daysBetween, formatDate } from "../../../shared/lib";
import { CountUp, Reveal } from "../../../shared/ui";

interface GuildPulseProps {
  readonly chronicle: GuildChronicleResponse;
  readonly memberCount: number;
}

type TotalKey = keyof GuildChronicleResponse["totals"];

const highlights: readonly { key: TotalKey; digits?: number }[] = [
  { key: "averageLevel", digits: 1 },
  { key: "questsCompleted" },
  { key: "bossKills" },
  { key: "achievements" },
  { key: "recipes" },
  { key: "mounts" },
  { key: "pets" },
  { key: "honorableKills" },
  { key: "exaltedReputations" },
];

export function GuildPulse({ chronicle, memberCount }: GuildPulseProps) {
  const { t, locale } = useLocale();
  const { totals, createdAt, coverage } = chronicle;
  return (
    <div className="guild-pulse">
      <Reveal className="pulse-lead">
        <p className="pulse-members">
          <CountUp value={memberCount} locale={locale} />
          <span>{t("pulse.members")}</span>
        </p>
        {createdAt ? (
          <p className="pulse-founded">
            {t("pulse.founded", {
              date: formatDate(createdAt, locale),
              days: daysBetween(createdAt),
            })}
          </p>
        ) : null}
        <p className="pulse-coverage">
          {t("pulse.coverage", {
            profiles: coverage.profiles,
            members: coverage.members,
          })}
        </p>
      </Reveal>
      <dl className="pulse-grid">
        {highlights.map((highlight, index) => (
          <Reveal
            key={highlight.key}
            className="pulse-tile"
            delayMs={index * 60}
          >
            <dt>{t(`pulse.${highlight.key}`)}</dt>
            <dd>
              <CountUp
                value={totals[highlight.key]}
                locale={locale}
                fractionDigits={highlight.digits ?? 0}
              />
            </dd>
          </Reveal>
        ))}
      </dl>
    </div>
  );
}
