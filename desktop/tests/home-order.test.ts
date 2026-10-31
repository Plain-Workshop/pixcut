import { describe, expect, it } from 'vitest';
import { dateBucket, homeProjectOrder, resumeProject } from '../src/app/home-order';
import type { ProjectSummary } from '../src/stores/library';

const entry = (id: string, updatedAt: number, favorite = false): ProjectSummary => ({ id, name: id, aspect: '16:9', sceneCount: 1, duration: 1, createdAt: 0, updatedAt, thumbnail: '', favorite });

describe('home project order', () => {
  it('puts favorites first and keeps recency inside each group', () => {
    const order = homeProjectOrder([entry('a', 5), entry('b', 4, true), entry('c', 3), entry('d', 2, true)]);
    expect(order.map(item => item.id)).toEqual(['b', 'd', 'a', 'c']);
  });
  it('limits the grid', () => {
    expect(homeProjectOrder(Array.from({ length: 9 }, (_, i) => entry(String(i), 9 - i)), 6)).toHaveLength(6);
  });
  it('resumes the most recently edited project', () => {
    expect(resumeProject([entry('a', 1), entry('b', 9), entry('c', 4)])?.id).toBe('b');
    expect(resumeProject([])).toBeNull();
  });
});

describe('date buckets', () => {
  const now = new Date(2026, 9, 29, 15, 0).getTime();
  const at = (daysAgo: number) => new Date(2026, 9, 29 - daysAgo, 9, 0).getTime();
  it('uses calendar days, not 24-hour windows', () => {
    expect(dateBucket(at(0), now)).toBe('Today');
    expect(dateBucket(new Date(2026, 9, 28, 23, 59).getTime(), now)).toBe('Yesterday');
    expect(dateBucket(at(3), now)).toBe('This week');
    expect(dateBucket(at(20), now)).toBe('This month');
    expect(dateBucket(at(90), now)).toBe('Earlier');
  });
  it('treats a future timestamp as today', () => {
    expect(dateBucket(now + 86_400_000, now)).toBe('Today');
  });
});
