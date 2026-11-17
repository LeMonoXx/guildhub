import type {
  FeaturedMembersResponse,
  GuildChronicleResponse,
  GuildHistoryResponse,
  GuildPartyResponse,
  GuildProfileResponse,
  GuildRosterResponse,
  WorldMapAtlas,
} from "@guildhub/contracts";

export interface GuildDataSource {
  getProfile(): Promise<GuildProfileResponse>;
  getRoster(): Promise<GuildRosterResponse>;
  getFeaturedMembers(): Promise<FeaturedMembersResponse>;
  getChronicle(): Promise<GuildChronicleResponse>;
  getHistory(): Promise<GuildHistoryResponse>;
  getParty(): Promise<GuildPartyResponse>;
  /** The in-game world map the baker stitched; absent until the first bake. */
  getWorldMap(): Promise<WorldMapAtlas>;
}
