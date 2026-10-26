import { expect, it } from 'vitest';
import { LatestRenderQueue } from '../src/components/preview/render-queue';
it('finishes a slow frame, coalesces intervening requests and recovers from decoding errors', async () => {
  const seen: number[] = []; const errors: unknown[] = []; let finish!: () => void;
  const queue = new LatestRenderQueue(error => errors.push(error));
  queue.enqueue(async () => { seen.push(1); await new Promise<void>(resolve => { finish = resolve; }); });
  queue.enqueue(async () => { seen.push(2); });
  queue.enqueue(async () => { seen.push(3); throw Error('decode'); });
  finish(); await new Promise(resolve => setTimeout(resolve, 0));
  expect(seen).toEqual([1, 3]); expect(errors).toHaveLength(1);
  queue.enqueue(async () => { seen.push(4); });
  await new Promise(resolve => setTimeout(resolve, 0)); expect(seen).toEqual([1, 3, 4]);
});
