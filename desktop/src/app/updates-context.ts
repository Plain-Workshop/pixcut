import type { useUpdates } from './hooks/useUpdates';
import { createValueContext } from './value-context';

/** Update state and actions, shared by the Home sidebar and Settings → Updates. */
export type UpdatesApi = ReturnType<typeof useUpdates>;
const context = createValueContext<UpdatesApi>('Updates');
export const UpdatesProvider = context.Provider;
export const useUpdatesApi = context.useValue;
