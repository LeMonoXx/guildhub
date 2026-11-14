import type { Clock } from "../../../platform/kernel/clock.js";
import type { ContentLocale } from "@guildhub/contracts";
import { appError } from "../../../platform/kernel/app-error.js";
import { err, ok, type Result } from "../../../platform/kernel/result.js";
import type {
  LoadMemberProfiles,
  MemberProfile,
} from "../../character/index.js";
import type {
  GetGuild,
  GetGuildRoster,
  GuildRef,
  GuildSourceError,
} from "../../guild/index.js";
import {
  calendarDay,
  type GuildDay,
  type MemberDay,
} from "../domain/guild-day.js";
import type { HistoryStore } from "./ports.js";

export interface RecordGuildDayDeps {
  readonly getGuild: GetGuild;
  readonly getRoster: GetGuildRoster;
  readonly loadProfiles: LoadMemberProfiles;
  readonly store: HistoryStore;
  readonly clock: Clock;
  readonly timeZone: string;
  /** Every language the site shows game texts in. */
  readonly locales: readonly ContentLocale[];
}

/** Records today's state of the guild and every member's published profile, once per language. */
export const makeRecordGuildDay =
  (deps: RecordGuildDayDeps) =>
  async (guild: GuildRef): Promise<Result<GuildDay, GuildSourceError>> => {
    const [profile, roster] = await Promise.all([
      deps.getGuild(guild),
      deps.getRoster(guild),
    ]);
    if (!roster.ok) return roster;
    const now = deps.clock.now();
    const days = await Promise.all(
      deps.locales.map(async (locale) => {
        const profiles = await deps.loadProfiles(roster.value.data, locale);
        const day: GuildDay = {
          day: calendarDay(now, deps.timeZone),
          locale,
          recordedAt: now,
          achievementPoints: profile.ok
            ? profile.value.data.achievementPoints
            : 0,
          members: profiles.map(toMemberDay),
        };
        await deps.store.save(guild, day);
        return day;
      }),
    );
    const [day] = days;
    if (day === undefined) return err(appError("upstream.unavailable"));
    return ok(day);
  };

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

export type RecordGuildDay = ReturnType<typeof makeRecordGuildDay>;
