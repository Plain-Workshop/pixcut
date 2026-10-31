import { createContext, createElement, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { clampZoom, MIN_TIMELINE_ZOOM } from '../components/timeline/ruler';

const KEY = 'pixcut-layout';
/** Hard ceiling for stored zoom; the panel narrows it to one frame per 16 px for the open story. */
export const STORED_ZOOM_LIMIT = 5000;

export type LayoutState = {
  libraryWidth: number;
  inspectorWidth: number;
  timelineHeight: number;
  timelineZoom: number;
  collapsedLanes: string[];
  lockedLanes: string[];
};

export const DEFAULT_LAYOUT: LayoutState = { libraryWidth: 280, inspectorWidth: 288, timelineHeight: 340, timelineZoom: 1, collapsedLanes: [], lockedLanes: [] };

const SIZE_LIMITS = { libraryWidth: [220, 380], inspectorWidth: [220, 380], timelineHeight: [230, 460] } as const;
const clampSize = (key: keyof typeof SIZE_LIMITS, value: unknown) => {
  const [low, high] = SIZE_LIMITS[key];
  const number = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_LAYOUT[key];
  return Math.min(high, Math.max(low, number));
};
const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];

/** Accepts whatever is in storage, including old layouts and garbage, and returns a valid layout. */
export function normalizeLayout(raw: unknown): LayoutState {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const zoom = Number(source.timelineZoom);
  return {
    libraryWidth: clampSize('libraryWidth', source.libraryWidth),
    inspectorWidth: clampSize('inspectorWidth', source.inspectorWidth),
    timelineHeight: clampSize('timelineHeight', source.timelineHeight),
    timelineZoom: Math.min(STORED_ZOOM_LIMIT, Math.max(MIN_TIMELINE_ZOOM, Number.isFinite(zoom) && zoom > 0 ? zoom : 1)),
    collapsedLanes: ids(source.collapsedLanes),
    lockedLanes: ids(source.lockedLanes),
  };
}

export type ResizeKind = 'library' | 'inspector' | 'timeline';

export type LayoutStore = {
  get: () => LayoutState;
  subscribe: (listener: () => void) => () => void;
  /** Drags a splitter. `start` is the panel's size when the drag began and `coord` the pointer position then. */
  beginResize: (kind: ResizeKind, start: number, coord: number) => void;
  setTimelineZoom: (value: number) => void;
  setCollapsedLanes: (lanes: string[]) => void;
  toggleLane: (id: string) => void;
  toggleLaneLock: (id: string) => void;
  /** Back to the default panel sizes, zoom and lanes. */
  reset: () => void;
};

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createLayoutStore(storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage): LayoutStore {
  const load = () => { try { return normalizeLayout(JSON.parse(storage?.getItem(KEY) || '{}')); } catch { return normalizeLayout({}); } };
  let state = load();
  const listeners = new Set<() => void>();
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(state)); } catch { /* layout is optional */ } };
  const emit = () => { for (const listener of [...listeners]) listener(); };
  /** Updates state; `persist: false` skips storage while a drag is still moving. */
  const change = (patch: Partial<LayoutState>, persist = true) => {
    const next = normalizeLayout({ ...state, ...patch });
    if (JSON.stringify(next) === JSON.stringify(state)) return;
    state = next;
    if (persist) save();
    emit();
  };
  return {
    get: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    beginResize(kind, start, coord) {
      const onMove = (event: PointerEvent) => {
        if (kind === 'library') change({ libraryWidth: start + (event.clientX - coord) }, false);
        else if (kind === 'inspector') change({ inspectorWidth: start + (coord - event.clientX) }, false);
        else change({ timelineHeight: start + (coord - event.clientY) }, false);
      };
      const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); save(); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    setTimelineZoom: value => change({ timelineZoom: clampZoom(value, STORED_ZOOM_LIMIT) }),
    setCollapsedLanes: lanes => change({ collapsedLanes: lanes }),
    toggleLane: id => change({ collapsedLanes: state.collapsedLanes.includes(id) ? state.collapsedLanes.filter(lane => lane !== id) : [...state.collapsedLanes, id] }),
    toggleLaneLock: id => change({ lockedLanes: state.lockedLanes.includes(id) ? state.lockedLanes.filter(lane => lane !== id) : [...state.lockedLanes, id] }),
    reset() {
      state = normalizeLayout({});
      try { storage?.removeItem(KEY); } catch { /* optional */ }
      emit();
    },
  };
}

const LayoutContext = createContext<LayoutStore | null>(null);

export function LayoutProvider({ store, children }: { store: LayoutStore; children?: ReactNode }) {
  return createElement(LayoutContext.Provider, { value: store }, children);
}

/** Creates a store that lives as long as the calling component. */
export function useCreateLayoutStore(): LayoutStore {
  const ref = useRef<LayoutStore | null>(null);
  ref.current ??= createLayoutStore();
  return ref.current;
}

/** Subscribes to the layout and returns it with the store's actions. */
export function useLayout(store?: LayoutStore): LayoutState & Omit<LayoutStore, 'get' | 'subscribe'> {
  const context = useContext(LayoutContext);
  const active = store ?? context;
  if (!active) throw new Error('useLayout needs a LayoutProvider or a store.');
  const state = useSyncExternalStore(active.subscribe, active.get, active.get);
  return { ...state, beginResize: active.beginResize, setTimelineZoom: active.setTimelineZoom, setCollapsedLanes: active.setCollapsedLanes, toggleLane: active.toggleLane, toggleLaneLock: active.toggleLaneLock, reset: active.reset };
}
