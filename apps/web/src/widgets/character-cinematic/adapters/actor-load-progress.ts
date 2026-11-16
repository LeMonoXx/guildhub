import type { AssetStore } from "../../character-model";

/**
 * Turns the shared store's byte progress into one fraction over all actors.
 * Each actor gets an equal share; the reported value never decreases.
 */
export class ActorLoadProgress {
  private reported = 0;
  private actorIndex = 0;
  private actorStart: ReturnType<AssetStore["progress"]>;
  private readonly stop: () => void;

  constructor(
    private readonly assets: AssetStore,
    private readonly actorCount: number,
    private readonly onProgress?: (fraction: number) => void,
  ) {
    this.actorStart = assets.progress();
    this.stop = assets.onProgress((progress) => {
      const requested = progress.requested - this.actorStart.requested;
      if (requested <= 0) return;
      const done =
        progress.fraction * progress.requested -
        this.actorStart.fraction * this.actorStart.requested;
      this.report(
        (this.actorIndex + Math.min(done / requested, 1)) / this.actorCount,
      );
    });
  }

  startActor(): void {
    this.actorStart = this.assets.progress();
  }

  finishActor(): void {
    this.actorIndex += 1;
    this.report(this.actorIndex / this.actorCount);
  }

  dispose(): void {
    this.stop();
  }

  private report(fraction: number): void {
    if (fraction <= this.reported) return;
    this.reported = fraction;
    this.onProgress?.(fraction);
  }
}
