import { describe, expect, it } from 'vitest';
import { parseIndexedSummaries } from '../src/stores/library-index';

const summary = (id: string, updatedAt: number) => ({
  id, name: `Project ${id}`, aspect: '16:9', sceneCount: 2, duration: 4,
  createdAt: 1, updatedAt, thumbnail: '', timebase: { numerator: 1, denominator: 30 },
});

describe('native library index rows', () => {
  it('parses rows and sorts newest first', () => {
    const rows = [JSON.stringify(summary('a', 10)), JSON.stringify(summary('b', 20))];
    expect(parseIndexedSummaries(rows).map(row => row.id)).toEqual(['b', 'a']);
  });

  it('keeps the export time and accepts rows written before it existed', () => {
    const rows = [JSON.stringify({ ...summary('old', 1) }), JSON.stringify({ ...summary('new', 2), exportedAt: 1234 })];
    const parsed = parseIndexedSummaries<ReturnType<typeof summary> & { exportedAt?: number }>(rows);
    expect(parsed.find(row => row.id === 'new')?.exportedAt).toBe(1234);
    expect(parsed.find(row => row.id === 'old')?.exportedAt).toBeUndefined();
  });

  it('skips corrupt, incomplete and unknown-aspect rows', () => {
    const rows = [
      'not json',
      JSON.stringify({ ...summary('missing', 5), thumbnail: undefined }),
      JSON.stringify({ ...summary('bad-aspect', 6), aspect: '3:2' }),
      JSON.stringify({ ...summary('bad-count', 7), sceneCount: 'two' }),
      JSON.stringify(summary('ok', 8)),
    ];
    expect(parseIndexedSummaries(rows).map(row => row.id)).toEqual(['ok']);
  });

  it('keeps optional fields untouched', () => {
    const row = JSON.stringify({ ...summary('grouped', 9), group: 'Travel', favorite: true });
    const [parsed] = parseIndexedSummaries([row]);
    expect(parsed).toMatchObject({ group: 'Travel', favorite: true });
  });
});
