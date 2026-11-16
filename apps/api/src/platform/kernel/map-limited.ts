/** Runs `run` over every item with at most `limit` calls in flight, keeping the order. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await run(items[index] as T);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
