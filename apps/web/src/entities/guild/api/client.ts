import { createFixtureGuildSource } from "./fixture-source";
import { guildQueries as createGuildQueries } from "./queries";

export const guildSource = createFixtureGuildSource();
export const guildQueries = createGuildQueries(guildSource);
