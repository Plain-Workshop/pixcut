import { describe, it, expect } from 'vitest';
import { backfillThumbnails, type ProjectSummary } from '../src/stores/library';

const summary = (id: string, thumbnail: string) => ({ id, name: id, thumbnail }) as ProjectSummary;

describe('thumbnail backfill', () => {
  it('does nothing when every project already has a preview', async () => {
    expect(await backfillThumbnails([summary('a', 'data:image/jpeg;base64,AA=='), summary('b', 'data:image/jpeg;base64,AA==')])).toBeNull();
  });
  it('does nothing for an empty library', async () => {
    expect(await backfillThumbnails([])).toBeNull();
  });
});
