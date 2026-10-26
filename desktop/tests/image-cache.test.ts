import { describe, expect, it } from 'vitest';
import { WeightedLru } from '../src/components/preview/image-cache';

describe('WeightedLru', () => {
  it('evicts the least recently used entry beyond the entry cap', () => {
    const cache = new WeightedLru<number>(2, 100);
    cache.set('a', 1); cache.set('b', 2);
    cache.get('a'); // a is now more recent than b
    cache.set('c', 3);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.keys).toEqual(['a', 'c']);
  });

  it('evicts by total weight and keeps the newest entry', () => {
    const cache = new WeightedLru<string>(10, 10);
    cache.set('a', 'A', 4); cache.set('b', 'B', 4); cache.set('c', 'C', 4);
    expect(cache.keys).toEqual(['b', 'c']);
    expect(cache.weight).toBe(8);
  });

  it('accounts for weights that are recorded after a pending value resolves', () => {
    const cache = new WeightedLru<{ ready: boolean }>(10, 10);
    cache.set('pending', { ready: false }, 0);
    expect(cache.weight).toBe(0);
    cache.weigh('pending', 8);
    expect(cache.weight).toBe(8);
    cache.weigh('pending', 3);
    expect(cache.weight).toBe(3);
  });

  it('keeps an entry that alone exceeds the budget so the visible image never cycles', () => {
    const cache = new WeightedLru<string>(10, 4);
    cache.set('big', 'BIG', 20);
    expect(cache.has('big')).toBe(true);
    expect(cache.weight).toBe(20);
  });

  it('drops older entries, including an oversized one, when a newer entry arrives', () => {
    const cache = new WeightedLru<string>(10, 4);
    cache.set('big', 'BIG', 20);
    cache.set('small', 'SMALL', 1);
    expect(cache.keys).toEqual(['small']);
    expect(cache.weight).toBe(1);
  });

  it('reports evictions and forgets weights', () => {
    const evicted: string[] = [];
    const cache = new WeightedLru<string>(1, 100, value => evicted.push(value));
    cache.set('a', 'A'); cache.set('b', 'B');
    expect(evicted).toEqual(['A']);
    expect(cache.delete('b')).toBe(true);
    expect(cache.weight).toBe(0);
    expect(cache.delete('b')).toBe(false);
  });

  it('touches entries without changing their weight', () => {
    const cache = new WeightedLru<string>(2, 100);
    cache.set('a', 'A', 5); cache.set('b', 'B', 7);
    cache.get('a');
    expect(cache.weight).toBe(12);
    expect(cache.size).toBe(2);
  });

  it('never grows when capacity is zero but still serves the newest value', () => {
    const cache = new WeightedLru<string>(0, 0);
    cache.set('a', 'A');
    expect(cache.size).toBe(1);
    cache.set('b', 'B');
    expect(cache.keys).toEqual(['b']);
  });
});
