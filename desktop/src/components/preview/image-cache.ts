/**
 * A small LRU cache that can be capped by entry count and by the memory held
 * by its values (decoded images are the main user). Weights are attached after
 * the value is known, so a pending entry costs nothing until it resolves.
 */
type Entry<V> = { value: V; weight: number };

export class WeightedLru<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private held = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxWeight: number,
    private readonly onEvict?: (value: V) => void,
  ) {}

  get size() { return this.entries.size; }
  get weight() { return this.held; }
  get keys() { return [...this.entries.keys()]; }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Touch: re-insert so the oldest entry is always first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  has(key: string) { return this.entries.has(key); }

  set(key: string, value: V, weight = 0) {
    const existing = this.entries.get(key);
    if (existing) {
      this.held -= existing.weight;
      this.entries.delete(key);
    }
    const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 0;
    this.entries.set(key, { value, weight: safeWeight });
    this.held += safeWeight;
    this.trim(key);
  }

  /** Records the real cost of a value that was inserted before it resolved. */
  weigh(key: string, weight: number) {
    const entry = this.entries.get(key);
    if (!entry) return;
    const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 0;
    this.held += safeWeight - entry.weight;
    entry.weight = safeWeight;
    this.trim(key);
  }

  delete(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.held -= entry.weight;
    return true;
  }

  clear() {
    this.entries.clear();
    this.held = 0;
  }

  /** Evicts least-recently-used entries, never the just-inserted key. */
  private trim(protectedKey?: string) {
    for (const key of [...this.entries.keys()]) {
      const withinCount = this.entries.size <= Math.max(1, this.maxEntries);
      const withinWeight = this.held <= Math.max(0, this.maxWeight);
      if (withinCount && withinWeight) return;
      if (key === protectedKey) continue;
      const entry = this.entries.get(key);
      if (!entry) continue;
      this.entries.delete(key);
      this.held -= entry.weight;
      try { this.onEvict?.(entry.value); } catch { /* eviction is best effort */ }
    }
  }
}
