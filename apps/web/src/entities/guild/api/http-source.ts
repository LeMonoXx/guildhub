import {
  featuredMembersResponseSchema,
  guildChronicleResponseSchema,
  guildHistoryResponseSchema,
  guildProfileResponseSchema,
  guildRosterResponseSchema,
} from "@guildhub/contracts";
import { getJson } from "../../../shared/api";
import type { GuildDataSource } from "./source";

export const createHttpGuildSource = (): GuildDataSource => ({
  getProfile: () => getJson("/api/guild", guildProfileResponseSchema),
  getRoster: () => getJson("/api/guild/roster", guildRosterResponseSchema),
  getFeaturedMembers: () =>
    getJson("/api/guild/featured", featuredMembersResponseSchema),
  getChronicle: () =>
    getJson("/api/guild/chronicle", guildChronicleResponseSchema),
  getHistory: () => getJson("/api/guild/history", guildHistoryResponseSchema),
});
