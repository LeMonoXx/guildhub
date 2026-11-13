import type { Disposable } from "./lifecycle";

export class StageSlot<T extends Disposable> implements Disposable {
  private current: T | undefined;
  private disposed = false;

  swap(next: T, attach: (value: T) => void, detach: (value: T) => void): void {
    if (this.disposed) {
      next.dispose();
      return;
    }
    if (this.current === next) return;
    if (this.current) {
      detach(this.current);
      this.current.dispose();
    }
    this.current = next;
    attach(next);
  }

  visit(action: (value: T) => void): void {
    if (!this.disposed && this.current) action(this.current);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.current?.dispose();
    this.current = undefined;
  }
}
