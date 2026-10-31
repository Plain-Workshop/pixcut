import { createContext, createElement, useContext, useRef, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { TimelineOverlay } from '../components/elements/overlays';
import type { AudioClip, Scene } from '../stores/model';

/** Edits staged by a drag or an inspector change that are not committed to the project yet. */
export type DraftsState = {
  /** A visual clip being moved, trimmed, framed or text-edited. */
  previewScene: Scene | null;
  overlayDraft: TimelineOverlay | null;
  /** A picture-in-picture clip being dragged. */
  pipDraft: Scene | null;
  audioDraft: AudioClip | null;
};

export const INITIAL_DRAFTS: DraftsState = { previewScene: null, overlayDraft: null, pipDraft: null, audioDraft: null };

export type DraftsSetters = { [K in keyof DraftsState as `set${Capitalize<K>}`]: Dispatch<SetStateAction<DraftsState[K]>> };

export type DraftsStore = {
  get: () => DraftsState;
  subscribe: (listener: () => void) => () => void;
  /** Stable setters shaped like useState's. */
  setters: DraftsSetters;
  /** Drops every staged edit. */
  clear: () => void;
};

export function createDraftsStore(): DraftsStore {
  let state = INITIAL_DRAFTS;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of [...listeners]) listener(); };
  const update = <K extends keyof DraftsState>(key: K) => (value: SetStateAction<DraftsState[K]>) => {
    const next = typeof value === 'function' ? (value as (previous: DraftsState[K]) => DraftsState[K])(state[key]) : value;
    if (Object.is(next, state[key])) return;
    state = { ...state, [key]: next };
    emit();
  };
  const setters = {
    setPreviewScene: update('previewScene'), setOverlayDraft: update('overlayDraft'), setPipDraft: update('pipDraft'), setAudioDraft: update('audioDraft'),
  } satisfies DraftsSetters;
  return {
    get: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setters,
    clear() {
      if (state === INITIAL_DRAFTS) return;
      state = INITIAL_DRAFTS;
      emit();
    },
  };
}

const DraftsContext = createContext<DraftsStore | null>(null);

export function DraftsProvider({ store, children }: { store: DraftsStore; children?: ReactNode }) {
  return createElement(DraftsContext.Provider, { value: store }, children);
}

/** Creates a store that lives as long as the calling component. */
export function useCreateDraftsStore(): DraftsStore {
  const ref = useRef<DraftsStore | null>(null);
  ref.current ??= createDraftsStore();
  return ref.current;
}

/** Subscribes to the staged edits and returns them with the stable setters. */
export function useDrafts(store?: DraftsStore): DraftsState & DraftsSetters {
  const context = useContext(DraftsContext);
  const active = store ?? context;
  if (!active) throw new Error('useDrafts needs a DraftsProvider or a store.');
  const state = useSyncExternalStore(active.subscribe, active.get, active.get);
  return { ...state, ...active.setters };
}
