import type { GuildDossier } from "@guildhub/contracts";
import { Link } from "@tanstack/react-router";
import { useState, type PointerEvent } from "react";
import {
  ClassColoredName,
  ClassMark,
  wowClassColorVar,
} from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import {
  formatNumber,
  formatRelativeTime,
  prefersReducedMotion,
} from "../../../shared/lib";
import { FallbackImage, Reveal } from "../../../shared/ui";

interface GuildDossiersProps {
  readonly dossiers: readonly GuildDossier[];
}

type Order = "level" | "itemLevel" | "recent";
const orders: readonly Order[] = ["level", "itemLevel", "recent"];

const sorters: Readonly<
  Record<Order, (a: GuildDossier, b: GuildDossier) => number>
> = {
  level: (a, b) =>
    b.level - a.level || b.achievementPoints - a.achievementPoints,
  itemLevel: (a, b) => (b.averageItemLevel ?? 0) - (a.averageItemLevel ?? 0),
  recent: (a, b) =>
    Date.parse(b.lastLoginAt ?? "1970-01-01") -
    Date.parse(a.lastLoginAt ?? "1970-01-01"),
};

const tilt = (event: PointerEvent<HTMLElement>) => {
  if (prefersReducedMotion()) return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width - 0.5;
  const y = (event.clientY - box.top) / box.height - 0.5;
  card.style.setProperty("--tilt-x", `${String(-y * 7)}deg`);
  card.style.setProperty("--tilt-y", `${String(x * 9)}deg`);
  card.style.setProperty("--glare-x", `${String((x + 0.5) * 100)}%`);
  card.style.setProperty("--glare-y", `${String((y + 0.5) * 100)}%`);
};

const untilt = (event: PointerEvent<HTMLElement>) => {
  event.currentTarget.style.setProperty("--tilt-x", "0deg");
  event.currentTarget.style.setProperty("--tilt-y", "0deg");
};

export function GuildDossiers({ dossiers }: GuildDossiersProps) {
  const { t, locale } = useLocale();
  const [order, setOrder] = useState<Order>("level");
  const sorted = [...dossiers].sort(sorters[order]);
  return (
    <div className="dossiers">
      <div className="segmented" role="group" aria-label={t("dossiers.sort")}>
        {orders.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={order === option}
            onClick={() => {
              setOrder(option);
            }}
          >
            {t(`dossiers.order.${option}`)}
          </button>
        ))}
      </div>
      <ul className="dossier-grid">
        {sorted.map((dossier, index) => (
          <Reveal key={dossier.slug} as="li" delayMs={(index % 8) * 50}>
            <Link
              to="/characters/$characterSlug"
              params={{ characterSlug: dossier.slug }}
              className="dossier-card"
              data-status={dossier.status}
              onPointerMove={tilt}
              onPointerLeave={untilt}
              style={{
                ["--dossier-class" as string]: wowClassColorVar(
                  dossier.classId,
                ),
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
                {dossier.lastLoginAt ? (
                  <p className="dossier-seen">
                    {t("character.lastSeen", {
                      when: formatRelativeTime(dossier.lastLoginAt, locale),
                    })}
                  </p>
                ) : dossier.status === "unavailable" ? (
                  <p className="dossier-seen">{t("dossiers.private")}</p>
                ) : null}
              </div>
            </Link>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}
