import type * as bridge from './bridge';
import { createValueContext } from './value-context';

/** What Settings → Storage & privacy shows and does about local storage. */
export type StorageApi = {
  storageUsage: bridge.AssetUsage | null;
  refreshAssetUsage: () => Promise<void>;
  storageBusy: boolean;
  cleanStorage: () => Promise<void>;
  storageConfirm: boolean;
  storageNote: string | null;
  storageLabel: string;
  refreshStorage: () => void;
};
const context = createValueContext<StorageApi>('Storage');
export const StorageProvider = context.Provider;
export const useStorageApi = context.useValue;
