import { wowForever } from "@blizzard-api/wow-forever";

// Forever keys a character by its exact lowercased name and surname. Accents
// are part of the key: "Morí" and "Mori" are different characters.
export function characterAppearanceEndpoint(name: string, surname: string) {
  return wowForever.characterAppearanceSummary(name, surname);
}

export function characterEquipmentEndpoint(name: string, surname: string) {
  return wowForever.characterEquipmentSummary(name, surname);
}

export function characterMediaEndpoint(name: string, surname: string) {
  return wowForever.characterMediaSummary(name, surname);
}

/** Every profile document Forever publishes for one character. */
export function characterProfileEndpoints(name: string, surname: string) {
  return {
    summary: wowForever.characterProfileSummary(name, surname),
    equipment: wowForever.characterEquipmentSummary(name, surname),
    statistics: wowForever.characterStatisticsSummary(name, surname),
    specializations: wowForever.characterSpecializationsSummary(name, surname),
    professions: wowForever.characterProfessionsSummary(name, surname),
    reputations: wowForever.characterReputationsSummary(name, surname),
    titles: wowForever.characterTitlesSummary(name, surname),
    pvp: wowForever.characterPvpSummary(name, surname),
    achievements: wowForever.characterAchievementsSummary(name, surname),
    achievementStatistics: wowForever.characterAchievementStatistics(
      name,
      surname,
    ),
    mounts: wowForever.characterMountsCollectionSummary(name, surname),
    pets: wowForever.characterPetsCollectionSummary(name, surname),
    toys: wowForever.characterToysCollectionSummary(name, surname),
    heirlooms: wowForever.characterHeirloomsCollectionSummary(name, surname),
    hunterPets: wowForever.characterHunterPetsSummary(name, surname),
    quests: wowForever.characterQuests(name, surname),
    completedQuests: wowForever.characterCompletedQuests(name, surname),
    media: wowForever.characterMediaSummary(name, surname),
  } as const;
}

export function itemMediaEndpoint(itemId: number) {
  return wowForever.itemMedia(itemId);
}

export function achievementEndpoint(achievementId: number) {
  return wowForever.achievement(achievementId);
}

export function achievementMediaEndpoint(achievementId: number) {
  return wowForever.achievementMedia(achievementId);
}
