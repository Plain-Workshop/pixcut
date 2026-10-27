/** Minimal fields every project summary needs before a card can render it. */
export type IndexedSummaryShape = {
  id: string;
  name: string;
  aspect: string;
  sceneCount: number;
  duration: number;
  createdAt: number;
  updatedAt: number;
  thumbnail: string;
};

/**
 * Parses native SQLite catalog rows defensively. A corrupt or outdated row is
 * skipped, and the IndexedDB copy can rebuild the catalog on the next save.
 */
export function parseIndexedSummaries<T extends IndexedSummaryShape>(rows: string[]): T[] {
  const summaries: T[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row) as Partial<T>;
      if (!parsed || typeof parsed.id !== 'string' || !parsed.id || typeof parsed.name !== 'string') continue;
      if (!['16:9', '9:16', '1:1', '4:5'].includes(String(parsed.aspect))) continue;
      if (typeof parsed.sceneCount !== 'number' || typeof parsed.duration !== 'number' || typeof parsed.createdAt !== 'number' || typeof parsed.updatedAt !== 'number' || typeof parsed.thumbnail !== 'string') continue;
      summaries.push(parsed as T);
    } catch { /* skip a malformed row */ }
  }
  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}
