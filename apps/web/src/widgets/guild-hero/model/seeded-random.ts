/** FNV-1a: a stable 32-bit hash, so the same member always gets the same routine. */
export const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** A small deterministic generator; equal seeds give equal sequences. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  static from(text: string): SeededRandom {
    return new SeededRandom(hashString(text));
  }

  next(): number {
    this.state = Math.imul(this.state ^ (this.state >>> 15), 0x2c1b3c6d) >>> 0;
    this.state = Math.imul(this.state ^ (this.state >>> 12), 0x297a2d39) >>> 0;
    return (this.state ^ (this.state >>> 15)) >>> 0;
  }

  below(limit: number): number {
    return limit <= 0 ? 0 : this.next() % limit;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swap = this.below(index + 1);
      [next[index], next[swap]] = [next[swap] as T, next[index] as T];
    }
    return next;
  }
}
