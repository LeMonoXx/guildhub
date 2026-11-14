import { createHttpGuildSource } from "./http-source";
import { guildQueries as createGuildQueries } from "./queries";

export const guildSource = createHttpGuildSource();
export const guildQueries = createGuildQueries(guildSource);
