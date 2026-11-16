import type { MemberProfile } from "../../character/index.js";
import type { MemberDay } from "../domain/guild-day.js";

export function toMemberDay({ member, profile }: MemberProfile): MemberDay {
  const base = {
    characterId: member.characterId,
    slug: member.slug,
    name: member.name,
    surname: member.surname,
    classId: member.classId,
    level: member.level,
    rankId: member.rankId,
  };
  if (profile.status !== "available")
    return {
      ...base,
      published: false,
      achievementPoints: 0,
      achievements: 0,
      equipment: [],
      professions: [],
      reputations: [],
      mounts: [],
    };
  const data = profile.data;
  const itemLevel =
    data.summary?.equippedItemLevel ?? data.summary?.averageItemLevel;
  return {
    ...base,
    published: true,
    ...(itemLevel === undefined ? {} : { itemLevel }),
    achievementPoints: data.summary?.achievementPoints ?? 0,
    achievements: data.achievements.total,
    equipment: data.equipment.map((item) => ({
      slot: item.slot,
      itemId: item.itemId,
      name: item.name,
      quality: item.quality,
      ...(item.itemLevel === undefined ? {} : { itemLevel: item.itemLevel }),
      ...(item.iconUrl === undefined ? {} : { iconUrl: item.iconUrl }),
    })),
    professions: data.professions.map((p) => ({
      name: p.name,
      skill: p.skill,
      maxSkill: p.maxSkill,
    })),
    reputations: data.reputations.map((r) => ({
      factionId: r.factionId,
      faction: r.faction,
      standing: r.standing,
      tier: r.tier,
    })),
    mounts: data.collections.mounts,
  };
}
