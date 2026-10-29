import { describe, expect, it } from 'vitest';
import { homeProjectOrder, resumeProject } from '../src/app/home-order';
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
