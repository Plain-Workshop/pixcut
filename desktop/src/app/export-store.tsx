import { createContext, createElement, useContext, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { ExportCodec, ExportContainer } from './bridge';
import { createKeyedStore, type KeyedSetters, type KeyedStore } from './keyed-store';

/** What the export dialog has chosen. Capabilities (which codecs exist, whether hardware works) are not choices and live elsewhere. */
export type ExportSettingsState = {
  quality: string;
  codec: ExportCodec;
  container: ExportContainer;
  speed: 'fast' | 'medium' | 'slow';
  /** Asked for; whether it is used also depends on the codec and the machine. */
  hardware: boolean;
  audio: boolean;
  saveCredits: boolean;
  resolution: string;
  fps: string;
  /** The delivery formats picked for this export. */
  formatIds: string[];
};

export const INITIAL_EXPORT: ExportSettingsState = {
  quality: 'standard', codec: 'h264', container: 'mp4', speed: 'medium', hardware: false, audio: true, saveCredits: true,
  resolution: 'project', fps: 'project', formatIds: [],
};

export type ExportStore = KeyedStore<ExportSettingsState>;

export const createExportStore = (): ExportStore => createKeyedStore(INITIAL_EXPORT);

/** Hardware encoding is only used for H.264 and HEVC, and only when the machine reports support. */
export function effectiveHardware(settings: Pick<ExportSettingsState, 'hardware' | 'codec'>, available: boolean): boolean {
  return settings.hardware && available && (settings.codec === 'h264' || settings.codec === 'hevc');
}

const ExportContext = createContext<ExportStore | null>(null);

export function ExportProvider({ store, children }: { store: ExportStore; children?: ReactNode }) {
  return createElement(ExportContext.Provider, { value: store }, children);
}

/** Creates a store that lives as long as the calling component. */
export function useCreateExportStore(): ExportStore {
  const ref = useRef<ExportStore | null>(null);
  ref.current ??= createExportStore();
  return ref.current;
}

/** Subscribes to the export choices and returns them with the stable setters. */
export function useExportSettings(store?: ExportStore): ExportSettingsState & KeyedSetters<ExportSettingsState> {
  const context = useContext(ExportContext);
  const active = store ?? context;
  if (!active) throw new Error('useExportSettings needs an ExportProvider or a store.');
  const state = useSyncExternalStore(active.subscribe, active.get, active.get);
  return { ...state, ...active.setters };
}
