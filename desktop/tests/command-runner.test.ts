import { describe, expect, it, vi } from 'vitest';
import { isLightCommand, runCommand, type RunnerDeps, type RunnerState } from '../src/app/command-runner';
import { emptyProject, type Command, type Project, type Scene, type Session } from '../src/stores/model';

const scene = (id: string) => ({ id }) as Scene;
const update = (id: string, name = id): Command => ({ type: 'update', scene: { ...scene(id), name } });
const rename = (name: string): Command => ({ type: 'rename', name });

function setup(options: { dispatch?: (command: Command) => Promise<Session>; applyOrder?: RunnerDeps['applyOrder'] } = {}) {
  const state: RunnerState = { operation: { current: false }, queue: { current: [] }, pending: { current: Promise.resolve(true) } };
  const project = emptyProject();
  const latest = { current: project };
  const log: string[] = [];
  const sent: Command[] = [];
  const deps: RunnerDeps = {
    dispatch: options.dispatch ?? (async command => { sent.push(command); return { project: { ...latest.current, name: command.type === 'rename' ? command.name : latest.current.name }, canUndo: true, canRedo: false }; }),
    applyOrder: options.applyOrder ?? (async () => ({ canUndo: true, canRedo: true })),
    edit: (before: Project) => ({ ...before, name: 'ordered' }),
    getProject: () => latest.current,
    setProject: next => { latest.current = next; },
    setSession: vi.fn(),
    setBusy: busy => log.push(`busy:${busy}`),
    stopPlayback: () => log.push('stop'),
    setStatus: status => log.push(status),
    setError: message => log.push(`error:${message}`),
    describeError: error => (error instanceof Error ? error.message : String(error)),
  };
  return { state, deps, latest, log, sent };
}

describe('command runner', () => {
  it('treats drags and level changes as light, structure changes as heavy', () => {
    expect(isLightCommand(update('a'))).toBe(true);
    expect(isLightCommand({ type: 'audio', audio: [] })).toBe(true);
    expect(isLightCommand(rename('x'))).toBe(false);
  });

  it('runs a heavy command: busy, stop playback, save, then free the lock', async () => {
    const { state, deps, latest, log } = setup();
    await expect(runCommand(rename('Trip'), state, deps)).resolves.toBe(true);
    expect(latest.current.name).toBe('Trip');
    expect(log).toEqual(['busy:true', 'stop', 'Saving…', 'busy:true', 'stop', 'Saved', 'busy:false']);
    expect(state.operation.current).toBe(false);
  });

  it('does not lock the UI or stop playback for a light command', async () => {
    const { state, deps, log } = setup();
    await runCommand(update('a'), state, deps);
    expect(log).toEqual(['Saving…', 'Saved', 'busy:false']);
  });

  it('runs queued commands in order after the one in flight', async () => {
    const { state, deps, sent } = setup();
    const first = runCommand(rename('one'), state, deps);
    const second = runCommand(rename('two'), state, deps);
    await Promise.all([first, second]);
    expect(sent.map(command => (command as { name: string }).name)).toEqual(['one', 'two']);
  });

  it('collapses queued updates of the same scene into the latest, but keeps other scenes', async () => {
    const { state, deps, sent } = setup();
    const first = runCommand(rename('slow'), state, deps);
    void runCommand(update('a', 'one'), state, deps);
    void runCommand(update('a', 'two'), state, deps);
    void runCommand(update('b', 'other'), state, deps);
    void runCommand(update('a', 'three'), state, deps);
    await first;
    await state.pending.current;
    const names = sent.filter(command => command.type === 'update').map(command => command.type === 'update' ? `${command.scene.id}:${command.scene.name}` : '');
    expect(names).toEqual(['a:two', 'b:other', 'a:three']);
  });

  it('applies an undo/redo order locally and trusts Rust only for the history flags', async () => {
    const { state, deps, latest } = setup();
    const order: Command = { type: 'order', kind: 'element', id: 'e', z: 1 };
    await runCommand(order, state, deps);
    expect(latest.current.name).toBe('ordered');
    expect(deps.setSession).toHaveBeenCalledWith(expect.objectContaining({ canUndo: true, canRedo: true }));
  });

  it('reports a failure, drops the queue, and resolves false', async () => {
    const { state, deps, log, sent } = setup({ dispatch: async command => { sent.push(command); throw new Error('disk full'); } });
    const first = runCommand(rename('a'), state, deps);
    void runCommand(rename('b'), state, deps);
    await expect(first).resolves.toBe(false);
    expect(sent).toHaveLength(1);
    expect(state.queue.current).toEqual([]);
    expect(log).toContain('error:disk full');
    expect(log).toContain('Changes not saved');
    expect(state.operation.current).toBe(false);
  });

  it('accepts a new command after a failure', async () => {
    let fail = true;
    const { state, deps, latest } = setup({ dispatch: async command => { if (fail) { fail = false; throw new Error('once'); } return { project: { ...latest.current, name: (command as { name: string }).name }, canUndo: true, canRedo: false }; } });
    await runCommand(rename('a'), state, deps);
    await expect(runCommand(rename('b'), state, deps)).resolves.toBe(true);
    expect(latest.current.name).toBe('b');
  });

  it('queues behind an operation started elsewhere, such as an import', async () => {
    const { state, deps, sent } = setup();
    state.operation.current = true;
    state.pending.current = Promise.resolve(true);
    void runCommand(rename('x'), state, deps);
    expect(sent).toEqual([]);
    expect(state.queue.current).toHaveLength(1);
  });
});
