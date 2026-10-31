import type { Command, Project, Session } from '../stores/model';

type Ref<T> = { current: T };

/** The shared state of the one command in flight, held in refs so other hooks can see it. */
export type RunnerState = {
  /** True while any operation (a command, an import, a recording) owns the project. */
  operation: Ref<boolean>;
  /** Commands waiting for the running one to finish. */
  queue: Ref<Command[]>;
  /** Settles when the running command and everything queued behind it is done. */
  pending: Ref<Promise<boolean>>;
};

export type RunnerDeps = {
  dispatch: (command: Command) => Promise<Session>;
  /** Records an undo/redo press; resolves with the history flags only. */
  applyOrder: (command: Command) => Promise<{ canUndo: boolean; canRedo: boolean }>;
  /** The same edit Rust will make, computed locally. */
  edit: (project: Project, command: Extract<Command, { type: 'order' }>) => Project;
  getProject: () => Project;
  setProject: (project: Project) => void;
  setSession: (session: Session) => void;
  setBusy: (busy: boolean) => void;
  stopPlayback: () => void;
  setStatus: (status: 'Saving…' | 'Saved' | 'Changes not saved') => void;
  setError: (message: string) => void;
  describeError: (error: unknown) => string;
};

/** Light commands (drags, order, audio levels) neither lock the UI nor stop playback. */
export function isLightCommand(command: Command): boolean {
  return command.type === 'order' || command.type === 'update' || command.type === 'updateMany'
    || command.type === 'audio' || command.type === 'audioMix' || command.type === 'overlays';
}

/**
 * Runs a command now, or queues it behind the one in flight. Queued scene
 * updates for the same scene collapse into the latest, so a fast drag sends one
 * save, not hundreds. A failure drops the queue and reports the error; the
 * returned promise resolves to whether everything succeeded.
 */
export function runCommand(command: Command, state: RunnerState, deps: RunnerDeps): Promise<boolean> {
  if (state.operation.current) {
    if (command.type === 'update') {
      const queued = state.queue.current;
      const last = queued.at(-1);
      if (last?.type === 'update' && last.scene.id === command.scene.id) queued[queued.length - 1] = command;
      else queued.push(command);
    } else {
      state.queue.current.push(command);
      if (!isLightCommand(command)) { deps.setBusy(true); deps.stopPlayback(); }
    }
    return state.pending.current;
  }
  state.operation.current = true;
  if (!isLightCommand(command)) { deps.setBusy(true); deps.stopPlayback(); }
  deps.setStatus('Saving…');
  const task = (async () => {
    let current: Command | undefined = command;
    let success = true;
    while (current) {
      if (!isLightCommand(current)) { deps.setBusy(true); deps.stopPlayback(); }
      try {
        if (current.type === 'order') {
          // Compute the same edit Rust will make, then ask Rust to record it.
          // The answer carries history flags only, never a project payload.
          const project = deps.edit(deps.getProject(), current);
          const history = await deps.applyOrder(current);
          deps.setProject(project);
          deps.setSession({ project, ...history });
        } else {
          const next = await deps.dispatch(current);
          deps.setProject(next.project);
          deps.setSession(next);
        }
        deps.setStatus('Saved');
      } catch (e) {
        success = false;
        state.queue.current = [];
        deps.setError(deps.describeError(e));
        deps.setStatus('Changes not saved');
        break;
      }
      current = state.queue.current.shift();
    }
    state.operation.current = false;
    deps.setBusy(false);
    return success;
  })();
  state.pending.current = task;
  return task;
}
