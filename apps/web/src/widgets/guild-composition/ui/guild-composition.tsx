import type { GuildChronicleResponse } from "@guildhub/contracts";
import {
  ClassMark,
  RaceMark,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";
import { ClassRing } from "./class-ring";

interface GuildCompositionProps {
  readonly chronicle: GuildChronicleResponse;
}

export function GuildComposition({ chronicle }: GuildCompositionProps) {
  const { t } = useLocale();
  const classMax = Math.max(
    1,
    ...chronicle.classes.map((entry) => entry.count),
  );
  const levelMax = Math.max(1, ...chronicle.levels.map((entry) => entry.count));
  return (
    <div className="composition">
      <Reveal className="composition-classes" as="article">
        <h3>{t("composition.classTitle")}</h3>
        <div className="composition-classes-body">
          <ClassRing classes={chronicle.classes} />
          <ul className="class-bars">
            {chronicle.classes.map((entry, index) => (
              <li
                key={entry.key}
                style={{
                  ["--bar-share" as string]: String(entry.count / classMax),
                  ["--bar-color" as string]: wowClassColorVar(entry.key),
                  ["--bar-delay" as string]: `${String(index * 70)}ms`,
                }}
              >
                <span className="wow-badge">
                  <ClassMark classId={entry.key} />
                  <span style={{ color: wowClassColorVar(entry.key) }}>
                    {t(`class.${entry.key}`)}
                  </span>
                </span>
                <span className="class-bar" aria-hidden="true" />
                <span className="class-bar-count">{entry.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <Reveal className="composition-races" as="article" delayMs={100}>
        <h3>{t("composition.raceTitle")}</h3>
        <ul className="race-chips">
          {chronicle.races.map((entry) => (
            <li key={entry.key}>
              <RaceMark raceId={entry.key} />
              <span>{t(`race.${entry.key}`)}</span>
              <strong>{entry.count}</strong>
            </li>
          ))}
        </ul>
        <h3>{t("composition.rankTitle")}</h3>
        <ul className="race-chips">
          {chronicle.ranks.map((entry) => (
            <li key={entry.key}>
              <span>{t(`rank.${entry.key}`)}</span>
              <strong>{entry.count}</strong>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal className="composition-levels" as="article" delayMs={200}>
        <h3>{t("composition.levelTitle")}</h3>
        <ol className="level-histogram">
          {chronicle.levels.map((bucket, index) => (
            <li
              key={bucket.from}
              style={{
                ["--bar-share" as string]: String(bucket.count / levelMax),
                ["--bar-delay" as string]: `${String(index * 60)}ms`,
              }}
            >
              <span className="level-count">{bucket.count}</span>
              <span className="level-bar" aria-hidden="true" />
              <span className="level-range">
                {bucket.from}–{bucket.to}
              </span>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  );
}
