import { createContext, createElement, useContext, useRef, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export type EditTarget = 'scene' | 'text' | 'element' | 'audio';

/** What is selected in the editor, across every kind of clip. Ids only; the project holds the clips. */
export type SelectionState = {
  /** Visual clips selected in the timeline (multi-select). */
  selectedIds: string[];
  /** The visual clip the inspector shows when several are selected. */
  primarySelected: string | null;
  selectedAudioId: string | null;
  selectedElementId: string | null;
  selectedPipId: string | null;
  selectedTextLayerId: string | null;
  selectedGlobalTextId: string | null;
  editTarget: EditTarget;
};

export const INITIAL_SELECTION: SelectionState = {
  selectedIds: [], primarySelected: null, selectedAudioId: null, selectedElementId: null,
  selectedPipId: null, selectedTextLayerId: null, selectedGlobalTextId: null, editTarget: 'scene',
};

export type SelectionSetters = { [K in keyof SelectionState as `set${Capitalize<K>}`]: Dispatch<SetStateAction<SelectionState[K]>> };

export type SelectionStore = {
  get: () => SelectionState;
  subscribe: (listener: () => void) => () => void;
  /** Stable setters shaped like useState's: they take a value or an updater function. */
  setters: SelectionSetters;
  reset: () => void;
};

/**
 * A small external store for selection. It replaces eight `useState` calls in
 * the editor with the same setter shape, so components can subscribe to it
 * directly instead of receiving selection and its setters as props.
 */
export function createSelectionStore(initial: SelectionState = INITIAL_SELECTION): SelectionStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const update = <K extends keyof SelectionState>(key: K) => (value: SetStateAction<SelectionState[K]>) => {
    const next = typeof value === 'function' ? (value as (previous: SelectionState[K]) => SelectionState[K])(state[key]) : value;
    if (Object.is(next, state[key])) return;
    state = { ...state, [key]: next };
    for (const listener of [...listeners]) listener();
  };
  const setters = {
    setSelectedIds: update('selectedIds'), setPrimarySelected: update('primarySelected'), setSelectedAudioId: update('selectedAudioId'),
    setSelectedElementId: update('selectedElementId'), setSelectedPipId: update('selectedPipId'), setSelectedTextLayerId: update('selectedTextLayerId'),
    setSelectedGlobalTextId: update('selectedGlobalTextId'), setEditTarget: update('editTarget'),
  } satisfies SelectionSetters;
  return {
    get: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setters,
    reset: () => { state = initial; for (const listener of [...listeners]) listener(); },
  };
}

const SelectionContext = createContext<SelectionStore | null>(null);

/** Creates the store once per editor and makes it available to everything below. */
export function SelectionProvider({ store, children }: { store: SelectionStore; children?: ReactNode }) {
  return createElement(SelectionContext.Provider, { value: store }, children);
}

/** Creates a store that lives as long as the calling component. */
export function useCreateSelectionStore(): SelectionStore {
  const ref = useRef<SelectionStore | null>(null);
  ref.current ??= createSelectionStore();
  return ref.current;
}

/** Subscribes to the whole selection and returns it with the stable setters. */
export function useSelection(store?: SelectionStore): SelectionState & SelectionSetters {
  const context = useContext(SelectionContext);
  const active = store ?? context;
  if (!active) throw new Error('useSelection needs a SelectionProvider or a store.');
  const state = useSyncExternalStore(active.subscribe, active.get, active.get);
  return { ...state, ...active.setters };
}
