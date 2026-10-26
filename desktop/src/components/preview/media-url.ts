import { loadAssetBlob } from '../../stores/assets';

/**
 * A media reference stays `pixcut-asset:<hash>` in the project. Native builds
 * resolve it through Tauri's asset protocol; the browser build resolves it to
 * an object URL backed by IndexedDB. Data and blob URLs pass through unchanged.
 */
const resolved = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const objectUrls = new Set<string>();

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
    const id = reference.slice('pixcut-asset:'.length);
    if (isNativeRuntime()) {
      const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');
      const path = await invoke<string>('asset_path', { reference });
      const url = convertFileSrc(path);
      resolved.set(reference, url);
      return url;
    }
    const blob = await loadAssetBlob(id);
    const url = URL.createObjectURL(blob);
    resolved.set(reference, url);
    objectUrls.add(url);
    // Keep the cache bounded; an evicted URL is released and can be recreated.
    while (resolved.size > 96) {
      const oldest = resolved.keys().next().value;
      if (oldest === undefined) break;
      const stale = resolved.get(oldest);
      resolved.delete(oldest);
      if (stale?.startsWith('blob:')) { URL.revokeObjectURL(stale); objectUrls.delete(stale); }
    }
    return url;
  })().finally(() => pending.delete(reference));
  pending.set(reference, task);
  return task;
}

/** Resolves a state value (data URL, blob URL, or asset reference) to a source. */
export async function resolveMediaSource(value?: string | null): Promise<string | undefined> {
  if (!value) return undefined;
  if (!isAssetRef(value)) return value;
  try { return await resolveAssetUrl(value); } catch { return undefined; }
}

export function releaseAssetUrls() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
  resolved.clear();
}
