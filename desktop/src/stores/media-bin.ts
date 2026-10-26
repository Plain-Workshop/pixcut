import { storeAssetDataUrl } from './assets';
import type { Scene } from './model';
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open('pixcut-media-bin', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('bins');
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
export async function loadMediaBin(id: string): Promise<Scene[]> {
  const db = await open();
  try {
    const rows = await new Promise<Scene[]>((resolve, reject) => { const req = db.transaction('bins').objectStore('bins').get(id); req.onsuccess = () => resolve(req.result ?? []); req.onerror = () => reject(req.error); });
    // Media stays as asset references and is resolved by the renderer/tiles.
    return rows;
  } finally { db.close(); }
}
export async function saveMediaBin(id: string, items: Scene[]) {
  const rows = structuredClone(items);
  for (const row of rows) { if (!row.image.startsWith('data:')) continue; const asset = await storeAssetDataUrl(row.image, row.name); row.image = `pixcut-asset:${asset.id}`; }
  const db = await open();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('bins', 'readwrite'); tx.objectStore('bins').put(rows, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
  finally { db.close(); }
}

// A source belongs once in the bin even when several timeline clips use it.
export function uniqueMediaSources(imported: readonly Scene[], scenes: readonly Scene[]): Scene[] {
  const sources = new Map<string, Scene>();
  for (const scene of [...imported, ...scenes]) if (!sources.has(scene.image)) sources.set(scene.image, scene);
  return [...sources.values()];
}
