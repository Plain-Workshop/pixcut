import { createContext, createElement, useContext, useRef, useSyncExternalStore, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ElementPreset } from '../components/elements/catalog';

export type AudioLibraryTab = 'project' | 'music' | 'sounds';

/** What the library panel is showing: searches, filters, open groups and what the pointer is over. */
export type LibraryState = {
  mediaQuery: string;
  hoveredMedia: string | null;
  audioLibraryTab: AudioLibraryTab;
  musicMood: string;
  soundQuery: string;
  openSoundGroup: string | null;
  elementSearch: string;
  elementCategory: string;
  elementCollection: string;
  /** How many element cards are drawn; "Show more" raises it. */
  elementLimit: number;
  hoveredElement: string | null;
};

export const ELEMENT_PAGE = 40;

export const INITIAL_LIBRARY: LibraryState = {
  mediaQuery: '', hoveredMedia: null, audioLibraryTab: 'project', musicMood: 'All', soundQuery: '', openSoundGroup: null,
  elementSearch: '', elementCategory: 'All', elementCollection: 'All', elementLimit: ELEMENT_PAGE, hoveredElement: null,
};

export type LibrarySetters = { [K in keyof LibraryState as `set${Capitalize<K>}`]: Dispatch<SetStateAction<LibraryState[K]>> };

export type LibraryStore = {
  get: () => LibraryState;
  subscribe: (listener: () => void) => () => void;
  setters: LibrarySetters;
  reset: () => void;
};

/** Keeps the element grid short again whenever the filter changes, so a new search never starts mid-list. */
const RESETS_LIMIT: ReadonlySet<keyof LibraryState> = new Set(['elementSearch', 'elementCategory', 'elementCollection']);

export function createLibraryStore(initial: LibraryState = INITIAL_LIBRARY): LibraryStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const emit = () => { for (const listener of [...listeners]) listener(); };
  const update = <K extends keyof LibraryState>(key: K) => (value: SetStateAction<LibraryState[K]>) => {
    const next = typeof value === 'function' ? (value as (previous: LibraryState[K]) => LibraryState[K])(state[key]) : value;
    if (Object.is(next, state[key])) return;
    state = { ...state, [key]: next, ...(RESETS_LIMIT.has(key) ? { elementLimit: ELEMENT_PAGE } : {}) };
    emit();
  };
  const setters = {
    setMediaQuery: update('mediaQuery'), setHoveredMedia: update('hoveredMedia'), setAudioLibraryTab: update('audioLibraryTab'),
    setMusicMood: update('musicMood'), setSoundQuery: update('soundQuery'), setOpenSoundGroup: update('openSoundGroup'),
    setElementSearch: update('elementSearch'), setElementCategory: update('elementCategory'), setElementCollection: update('elementCollection'),
    setElementLimit: update('elementLimit'), setHoveredElement: update('hoveredElement'),
  } satisfies LibrarySetters;
  return {
    get: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setters,
    reset: () => { state = initial; emit(); },
  };
}

/** The presets that match a category, a collection and a search text. "All" matches everything. */
export function filterElements(presets: readonly ElementPreset[], filter: Pick<LibraryState, 'elementCategory' | 'elementCollection' | 'elementSearch'>): ElementPreset[] {
  const needle = filter.elementSearch.trim().toLocaleLowerCase();
  return presets.filter(preset =>
    (filter.elementCategory === 'All' || preset.category === filter.elementCategory)
    && (filter.elementCollection === 'All' || preset.collection === filter.elementCollection)
    && `${preset.label} ${preset.collectionLabel} ${preset.text} ${preset.icon}`.toLocaleLowerCase().includes(needle));
}

const LibraryContext = createContext<LibraryStore | null>(null);

export function LibraryProvider({ store, children }: { store: LibraryStore; children?: ReactNode }) {
  return createElement(LibraryContext.Provider, { value: store }, children);
}

/** Creates a store that lives as long as the calling component. */
export function useCreateLibraryStore(): LibraryStore {
  const ref = useRef<LibraryStore | null>(null);
  ref.current ??= createLibraryStore();
  return ref.current;
}

/** Subscribes to the library state and returns it with the stable setters. */
export function useLibraryState(store?: LibraryStore): LibraryState & LibrarySetters {
  const context = useContext(LibraryContext);
  const active = store ?? context;
  if (!active) throw new Error('useLibraryState needs a LibraryProvider or a store.');
  const state = useSyncExternalStore(active.subscribe, active.get, active.get);
  return { ...state, ...active.setters };
}
