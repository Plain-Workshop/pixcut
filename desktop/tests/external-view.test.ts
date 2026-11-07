import { describe, expect, it } from 'vitest';
import { settleBeforeExternalView, type RunnerState } from '../src/app/command-runner';

function state(): RunnerState {
  return {
    operation: { current: false },
    queue: { current: [] },
    pending: { current: Promise.resolve(true) },
  };
}

describe('showing an agent change', () => {
  it('applies immediately when the editor is idle', async () => {
    await expect(settleBeforeExternalView(state())).resolves.toBe(true);
  });

  it('waits for the command in flight before the view is replaced', async () => {
    const runner = state();
    runner.operation.current = true;
    let finish: (value: boolean) => void = () => {};
    runner.pending.current = new Promise<boolean>(resolve => { finish = resolve; });
    let settled = false;
    const applying = settleBeforeExternalView(runner).then(value => { settled = value; });
    await Promise.resolve();
    expect(settled).toBe(false);
    runner.operation.current = false;
    finish(true);
    await applying;
    expect(settled).toBe(true);
  });

  it('gives up when the editor never becomes idle', async () => {
    const runner = state();
    runner.operation.current = true;
    await expect(settleBeforeExternalView(runner, 2)).resolves.toBe(false);
  });
});
