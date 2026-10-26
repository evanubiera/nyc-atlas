/**
 * A bounded cache whose entries expire.
 *
 * Both limits matter here. The TTL is what keeps a long-lived process from
 * serving figures from an ingest that has since been replaced; the entry cap
 * is what stops an unbounded query space — category x exposure x scope x
 * period x borough filter — from pinning every combination anyone ever asked
 * for in memory.
 *
 * Recency is tracked by Map insertion order: a hit re-inserts its key, so the
 * oldest key is always the least recently used.
 */
export class LruCache<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Re-insert so this key moves to the newest end of the iteration order.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Delete first so an overwrite also counts as a use.
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  /** Called when the data underneath changes; a stale hit would outlive it. */
  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
