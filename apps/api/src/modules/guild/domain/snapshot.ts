import type { GuildRef } from "./guild-ref.js";

export interface GuildSnapshot<T> {
  readonly guild: GuildRef;
  readonly fetchedAt: Date;
  readonly payload: T;
}
