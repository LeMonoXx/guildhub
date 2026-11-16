import type {
  CharacterDetailResponse,
  CharacterProfileResponse,
} from "@guildhub/contracts";
import {
  ClassColoredName,
  RaceMark,
  powerColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { CountUp, FallbackImage } from "../../../shared/ui";

export function UnitFrame({
  character,
  profile,
}: {
  readonly character: CharacterDetailResponse;
  readonly profile?: CharacterProfileResponse | undefined;
}) {
  const { t, locale } = useLocale();
  const stats = profile?.statistics;
  const avatar = profile?.avatarUrl;
  return (
    <div className="unit-frame">
      <div className="unit-frame-portrait">
        <FallbackImage
          src={avatar}
          fallback={<RaceMark raceId={character.raceId} />}
        />
        <span className="unit-frame-level" title={t("members.level")}>
          {character.level}
        </span>
      </div>
      <div className="unit-frame-bars">
        <p className="unit-frame-name">
          <ClassColoredName classId={character.classId}>
            {character.name}
          </ClassColoredName>
        </p>
        <div
          className="unit-frame-bar unit-frame-health"
          style={{ ["--bar-color" as string]: "var(--power-health)" }}
        >
          <span>
            {stats ? <CountUp value={stats.health} locale={locale} /> : "—"}
          </span>
        </div>
        <div
          className="unit-frame-bar"
          style={{
            ["--bar-color" as string]: powerColorVar(stats?.powerType),
          }}
        >
          <span>
            {stats ? <CountUp value={stats.power} locale={locale} /> : "—"}{" "}
            {stats?.powerType ? (
              <small>{t(`power.${stats.powerType.toLowerCase()}`)}</small>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}
