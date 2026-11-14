import { fixtureGuildChronicle } from "./chronicle-fixtures";
import { fixtureGuildHistory } from "./history-fixtures";
import {
  fixtureFeaturedMembers,
  fixtureGuildProfile,
  fixtureGuildRoster,
} from "./fixtures";
import type { GuildDataSource } from "./source";

export const createFixtureGuildSource = (): GuildDataSource => ({
  getProfile: () => Promise.resolve(fixtureGuildProfile()),
  getRoster: () => Promise.resolve(fixtureGuildRoster()),
  getFeaturedMembers: () => Promise.resolve(fixtureFeaturedMembers()),
  getChronicle: () => Promise.resolve(fixtureGuildChronicle()),
  getHistory: () => Promise.resolve(fixtureGuildHistory()),
});
