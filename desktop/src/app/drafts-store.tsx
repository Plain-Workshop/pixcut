import { useRef } from 'react';
import type { TimelineOverlay } from '../components/elements/overlays';
import type { AudioClip, Scene } from '../stores/model';
import { createKeyedStore, createStoreKit, type KeyedSetters, type KeyedStore } from './keyed-store';

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

export type DraftsSetters = KeyedSetters<DraftsState>;
export type DraftsStore = KeyedStore<DraftsState> & {
  /** Drops every staged edit in one notification. */
  clear: () => void;
};

export function createDraftsStore(): DraftsStore {
  const store = createKeyedStore(INITIAL_DRAFTS);
  return { ...store, clear: store.reset };
}

const kit = createStoreKit('Drafts', INITIAL_DRAFTS);
export const DraftsProvider = kit.Provider;
/** Creates a store that lives as long as the calling component. */
export function useCreateDraftsStore(): DraftsStore {
  const ref = useRef<DraftsStore | null>(null);
  ref.current ??= createDraftsStore();
  return ref.current;
}
export const useDrafts = kit.useStore;
