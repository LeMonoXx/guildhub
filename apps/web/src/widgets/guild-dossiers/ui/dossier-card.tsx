import type { GuildDossier } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import {
  ClassColoredName,
  ClassMark,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { formatNumber } from "../../../shared/lib";
import { FallbackImage } from "../../../shared/ui";
import { resetTilt, tiltTowardPointer } from "../lib/card-tilt";
import { DossierSeen } from "./dossier-seen";

export function DossierCard({ dossier }: { readonly dossier: GuildDossier }) {
  const { t, locale } = useLocale();
  return (
    <Link
      to="/characters/$characterSlug"
      params={{ characterSlug: dossier.slug }}
      className="dossier-card"
      data-status={dossier.status}
      onPointerMove={tiltTowardPointer}
      onPointerLeave={resetTilt}
      style={{
        ["--dossier-class" as string]: wowClassColorVar(dossier.classId),
      }}
    >
      <span className="dossier-glare" aria-hidden="true" />
      <div className="dossier-portrait">
        <FallbackImage
          src={dossier.avatarUrl}
          loading="lazy"
          fallback={<ClassMark classId={dossier.classId} />}
        />
        <span className="unit-frame-level">{dossier.level}</span>
      </div>
      <div className="dossier-body">
        <p className="dossier-name">
          <ClassColoredName classId={dossier.classId}>
            {dossier.name}
          </ClassColoredName>
          <span className="dossier-surname">{dossier.surname}</span>
        </p>
        <p className="dossier-spec">
          {[dossier.specialization, t(`class.${dossier.classId}`)]
            .filter(Boolean)
            .join(" ")}
        </p>
        <dl className="dossier-stats">
          <div>
            <dt>{t("dossiers.ilvl")}</dt>
            <dd>
              {dossier.averageItemLevel === undefined
                ? "—"
                : formatNumber(dossier.averageItemLevel, locale)}
            </dd>
          </div>
          <div>
            <dt>{t("dossiers.quests")}</dt>
            <dd>{formatNumber(dossier.questsCompleted, locale)}</dd>
          </div>
          <div>
            <dt>{t("dossiers.mounts")}</dt>
            <dd>{dossier.mounts}</dd>
          </div>
        </dl>
        {dossier.professions.length > 0 ? (
          <p className="dossier-professions">
            {dossier.professions
              .map(
                (profession) =>
                  `${profession.name} ${String(profession.skill)}`,
              )
              .join(" · ")}
          </p>
        ) : null}
        <DossierSeen dossier={dossier} />
      </div>
    </Link>
  );
}
