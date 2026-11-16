import type { ContentLocale } from "@guildhub/contracts";

interface Loaded<T> {
  readonly value: T;
  readonly loadedAt: number;
}

/** Keeps one value in memory and reloads it once it is older than `maxAgeMs`. */
class Memo<T> {
  private current: Loaded<T> | undefined;
  private pending: Promise<T> | undefined;

  constructor(
    private readonly load: () => Promise<T>,
    private readonly now: () => number,
    private readonly maxAgeMs: number,
  ) {}

  async get(): Promise<T> {
    const current = this.current;
    if (current && this.now() - current.loadedAt < this.maxAgeMs)
      return current.value;
    this.pending ??= this.load()
      .then((value) => {
        this.current = { value, loadedAt: this.now() };
        return value;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return this.pending;
  }
}

/** One memo per language. */
export class LocaleMemo<T> {
  private readonly byLocale = new Map<ContentLocale, Memo<T>>();

  constructor(
    private readonly load: (locale: ContentLocale) => Promise<T>,
    private readonly now: () => number,
    private readonly maxAgeMs: number,
  ) {}

  get(locale: ContentLocale): Promise<T> {
    let memo = this.byLocale.get(locale);
    if (!memo) {
      memo = new Memo(() => this.load(locale), this.now, this.maxAgeMs);
      this.byLocale.set(locale, memo);
    }
    return memo.get();
  }
}
