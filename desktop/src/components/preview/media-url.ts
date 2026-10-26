/**
 * Imported video can stay on disk as a `pixcut-asset:<hash>` reference. Native
 * builds turn that reference into an `asset://` URL through Tauri's asset
 * protocol, so the editor never holds the clip as base64. The browser build has
 * no references (its store hydrates to data URLs) and returns nothing here.
 */
const resolved = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

export function isAssetRef(value?: string | null): boolean {
  return Boolean(value && value.startsWith('pixcut-asset:'));
}

export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function resolveAssetUrl(reference: string): Promise<string> {
  const cached = resolved.get(reference);
  if (cached) return cached;
  const inFlight = pending.get(reference);
  if (inFlight) return inFlight;
  const task = (async () => {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
    const path = await invoke<string>('asset_path', { reference });
    const url = convertFileSrc(path);
    resolved.set(reference, url);
    return url;
  })().finally(() => pending.delete(reference));
  pending.set(reference, task);
  return task;
}

/** Resolves a state value (data URL, blob URL, or asset reference) to a source. */
export async function resolveMediaSource(value?: string | null): Promise<string | undefined> {
  if (!value) return undefined;
  if (!isAssetRef(value)) return value;
  if (!isNativeRuntime()) return undefined;
  try { return await resolveAssetUrl(value); } catch { return undefined; }
}
