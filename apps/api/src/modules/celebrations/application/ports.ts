import type { Celebration } from "../domain/celebration.js";

export interface CelebrationNotifier {
  /** Posts every celebration of one check; throws when the channel refuses them. */
  announce(celebrations: readonly Celebration[]): Promise<void>;
}
