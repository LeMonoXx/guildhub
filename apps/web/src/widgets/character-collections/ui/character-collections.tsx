import type { CharacterProfileResponse } from "@guildhub/contracts";
import type { ReactNode } from "react";
import { itemQualityColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { Reveal } from "../../../shared/ui";

interface CharacterCollectionsProps {
  readonly profile: CharacterProfileResponse;
}

function Shelf({
  title,
  count,
  children,
  delayMs,
}: {
  readonly title: string;
  readonly count: number;
  readonly children: ReactNode;
  readonly delayMs: number;
}) {
  return (
    <Reveal className="collection-shelf" delayMs={delayMs} as="article">
      <header>
        <h3>{title}</h3>
        <span className="collection-count">{count}</span>
      </header>
      {children}
    </Reveal>
  );
}

export function CharacterCollections({ profile }: CharacterCollectionsProps) {
  const { t } = useLocale();
  const { mounts, pets, toys, heirlooms } = profile.collections;
  const shelves = [
    mounts.length > 0 ? (
      <Shelf
        key="mounts"
        title={t("collections.mounts")}
        count={mounts.length}
        delayMs={0}
      >
        <ul className="collection-tags">
          {mounts.map((mount) => (
            <li key={mount}>{mount}</li>
          ))}
        </ul>
      </Shelf>
    ) : null,
    pets.length > 0 ? (
      <Shelf
        key="pets"
        title={t("collections.pets")}
        count={pets.length}
        delayMs={80}
      >
        <ul className="collection-tags">
          {pets.map((pet, index) => (
            <li
              key={`${pet.name}-${String(index)}`}
              style={
                pet.quality
                  ? { color: itemQualityColorVar(pet.quality) }
                  : undefined
              }
            >
              {pet.name}
              {pet.level > 1 ? (
                <small>{t("collections.level", { level: pet.level })}</small>
              ) : null}
            </li>
          ))}
        </ul>
      </Shelf>
    ) : null,
    profile.hunterPets.length > 0 ? (
      <Shelf
        key="hunter"
        title={t("collections.hunterPets")}
        count={profile.hunterPets.length}
        delayMs={160}
      >
        <ul className="hunter-pets">
          {profile.hunterPets.map((pet) => (
            <li key={pet.name} data-active={pet.active}>
              <strong>{pet.name}</strong>
              <span>
                {[pet.creature, t("collections.level", { level: pet.level })]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {pet.active ? <em>{t("collections.active")}</em> : null}
            </li>
          ))}
        </ul>
      </Shelf>
    ) : null,
    toys.length > 0 ? (
      <Shelf
        key="toys"
        title={t("collections.toys")}
        count={toys.length}
        delayMs={240}
      >
        <ul className="collection-tags">
          {toys.map((toy) => (
            <li key={toy}>{toy}</li>
          ))}
        </ul>
      </Shelf>
    ) : null,
    heirlooms.length > 0 ? (
      <Shelf
        key="heirlooms"
        title={t("collections.heirlooms")}
        count={heirlooms.length}
        delayMs={320}
      >
        <ul className="collection-tags">
          {heirlooms.map((heirloom) => (
            <li
              key={heirloom}
              style={{ color: itemQualityColorVar("HEIRLOOM") }}
            >
              {heirloom}
            </li>
          ))}
        </ul>
      </Shelf>
    ) : null,
  ].filter(Boolean);

  return shelves.length > 0 ? (
    <div className="collections">{shelves}</div>
  ) : (
    <p className="muted">{t("collections.empty")}</p>
  );
}
