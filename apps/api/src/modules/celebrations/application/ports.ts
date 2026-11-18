import type { Celebration } from "../domain/celebration.js";

export interface CelebrationNotifier {
  /** The most celebrations one post may carry. */
  readonly batchSize: number;
  /** Posts one batch at once; throws when the channel refuses it. */
  announce(celebrations: readonly Celebration[]): Promise<void>;
}

export interface CelebrationQueue {
  /** Hands one post over for delivery, retried until the channel takes it. */
  enqueue(celebrations: readonly Celebration[]): Promise<void>;
}
