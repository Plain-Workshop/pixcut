import { createStoreKit } from './keyed-store';
import type { ModalId } from './modal';
import type { SettingsTab } from './modals/SettingsModal';

export type LibraryTab = 'media' | 'text' | 'elements' | 'audio' | 'templates';

/** Transient interface state the panels share: which dialog is open, drags in progress, the Home filters. */
export type UiState = {
  modal: ModalId | null;
  tab: LibraryTab;
  settingsTab: SettingsTab;
  homeSection: 'home' | 'projects';
  libraryQuery: string;
  librarySort: 'recent' | 'name' | 'duration';
  favoriteOnly: boolean;
  snapGuides: { x: number | null; y: number | null };
  safeArea: boolean;
  framingMode: boolean;
  editingText: boolean;
  textDraft: { title: string; subtitle: string };
  textFocus: number;
  contextMenu: { x: number; y: number } | null;
  dropTarget: string | null;
  reorderId: string | null;
  replacingSceneId: string | null;
  fileDragActive: boolean;
  fadeDrag: { sceneId: string; side: 'in' | 'out'; value: number } | null;
  videoVolumeDraft: { id: string; value: number } | null;
  audioDisplay: 'spectrogram' | 'waveform';
};

export const INITIAL_UI: UiState = {
  modal: null, tab: 'media', settingsTab: 'general', homeSection: 'home', libraryQuery: '', librarySort: 'recent', favoriteOnly: false,
  snapGuides: { x: null, y: null }, safeArea: false, framingMode: false, editingText: false, textDraft: { title: '', subtitle: '' }, textFocus: 0,
  contextMenu: null, dropTarget: null, reorderId: null, replacingSceneId: null, fileDragActive: false, fadeDrag: null, videoVolumeDraft: null,
  audioDisplay: 'spectrogram',
};

const kit = createStoreKit('Ui', INITIAL_UI);
export const createUiStore = kit.create;
export const UiProvider = kit.Provider;
export const useCreateUiStore = kit.useCreate;
export const useUi = kit.useStore;
