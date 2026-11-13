import type {
  FeaturedMembersResponse,
  GuildProfileResponse,
  GuildRosterResponse,
} from "@guildhub/contracts";

export interface GuildDataSource {
  getProfile(): Promise<GuildProfileResponse>;
  getRoster(): Promise<GuildRosterResponse>;
  getFeaturedMembers(): Promise<FeaturedMembersResponse>;
}
