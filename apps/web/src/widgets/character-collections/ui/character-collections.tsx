import type { CharacterProfileResponse } from "@guildhub/contracts";
import { itemQualityColorVar } from "../../../entities/character";
import { useLocale } from "../../../shared/i18n";
import { CollectionShelf } from "./collection-shelf";

interface CharacterCollectionsProps {
  readonly profile: CharacterProfileResponse;
}

export function CharacterCollections({ profile }: CharacterCollectionsProps) {
  const { t } = useLocale();
  const { mounts, pets, toys, heirlooms } = profile.collections;
  const shelves = [
    mounts.length > 0 ? (
      <CollectionShelf
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
      </CollectionShelf>
    ) : null,
    pets.length > 0 ? (
      <CollectionShelf
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
      </CollectionShelf>
    ) : null,
    profile.hunterPets.length > 0 ? (
      <CollectionShelf
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
      </CollectionShelf>
    ) : null,
    toys.length > 0 ? (
      <CollectionShelf
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
      </CollectionShelf>
    ) : null,
    heirlooms.length > 0 ? (
      <CollectionShelf
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
      </CollectionShelf>
    ) : null,
  ].filter(Boolean);

  return shelves.length > 0 ? (
    <div className="collections">{shelves}</div>
  ) : (
    <p className="muted">{t("collections.empty")}</p>
  );
}
