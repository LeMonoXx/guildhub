import type {
  FeaturedMembersResponse,
  GuildChronicleResponse,
  GuildHistoryResponse,
  GuildProfileResponse,
  GuildRosterResponse,
} from "@guildhub/contracts";

export interface GuildDataSource {
  getProfile(): Promise<GuildProfileResponse>;
  getRoster(): Promise<GuildRosterResponse>;
  getFeaturedMembers(): Promise<FeaturedMembersResponse>;
  getChronicle(): Promise<GuildChronicleResponse>;
  getHistory(): Promise<GuildHistoryResponse>;
}
