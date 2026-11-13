export type GuildFaction = "ALLIANCE" | "HORDE" | "NEUTRAL";

export interface GuildProfile {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly faction: GuildFaction;
  readonly achievementPoints: number;
  readonly memberCount: number;
}
