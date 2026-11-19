import { createKeyedStore, createStoreKit, type KeyedSetters, type KeyedStore } from './keyed-store';

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

export type SelectionSetters = KeyedSetters<SelectionState>;
export type SelectionStore = KeyedStore<SelectionState>;

/**
 * A small external store for selection, with the same setter shape as `useState`
 * so components can subscribe to it directly instead of receiving selection and
 * its setters as props.
 */
export const createSelectionStore = (initial: SelectionState = INITIAL_SELECTION): SelectionStore => createKeyedStore(initial);

const kit = createStoreKit('Selection', INITIAL_SELECTION);
export const SelectionProvider = kit.Provider;
export const useCreateSelectionStore = kit.useCreate;
export const useSelection = kit.useStore;
