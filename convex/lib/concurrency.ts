// Bounded-concurrency map for the warmup rounds.
//
// Both rounds used to walk their work strictly one item at a time, each item
// costing an SES call or a fresh IMAP session. That is fine for a handful of
// mailboxes and runs into the Convex action time limit well before the warmup
// pool gets large. A small limit keeps the wall clock down without opening
// enough simultaneous connections for Gmail to object.
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await fn(items[index], index);
      }
    }
  );

  await Promise.all(workers);
  return results;
}
