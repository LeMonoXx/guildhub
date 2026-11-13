import type { Disposable } from "./lifecycle";

export class ResourceOwner implements Disposable {
  private readonly resources = new Set<Disposable>();
  private disposed = false;

  own<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      resource.dispose();
      throw new Error("Cannot own a resource after disposal");
    }
    this.resources.add(resource);
    return resource;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) resource.dispose();
    this.resources.clear();
  }
}
