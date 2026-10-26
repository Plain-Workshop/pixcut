import type { Project } from './model';

type AssetRow = {
  id: string;
  name: string;
  mime: string;
  bytes: number;
  data?: ArrayBuffer;
  blob?: Blob;
};

const DB_NAME = 'pixcut-assets';
const DB_VERSION = 1;
const STORE = 'assets';
const PREFIX = 'pixcut-asset:';
const cache = new Map<string, string>();
const idCache = new Map<string, string>();
let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function dataUrlParts(data: string) {
  const comma = data.indexOf(',');
  if (comma < 0) throw new Error('A local asset is not a data URL.');
  const meta = data.slice(5, comma);
  if (!meta.endsWith(';base64')) throw new Error('A local asset uses an unsupported encoding.');
  const mime = meta.slice(0, -7);
  const binary = atob(data.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return { mime, bytes };
}

async function hashBytes(bytes: Uint8Array) {
  try {
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fall through to the deterministic local hash */ }
  const seeds = [0xcbf29ce484222325n, 0x84222325cbf29ce4n, 0x9e3779b97f4a7c15n, 0xd6e8feb86659fd93n];
  const prime = 0x100000001b3n;
  return seeds.map((seed, lane) => {
    let hash = seed;
    for (const byte of bytes) {
      hash ^= BigInt(byte + lane);
      hash = BigInt.asUintN(64, hash * prime);
    }
    return hash.toString(16).padStart(16, '0');
  }).join('');
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read a local asset.'));
    reader.readAsDataURL(blob);
  });
}

export async function storeAssetDataUrl(data: string, name: string) {
  const cachedId = idCache.get(data);
  if (cachedId) return { id: cachedId, name, mime: '', bytes: 0 };
  const { mime, bytes } = dataUrlParts(data);
  const id = await hashBytes(bytes);
  const db = await openDatabase();
  const existing = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)) as AssetRow | undefined;
  if (!existing) {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ id, name, mime, bytes: bytes.length, data: bytes.slice().buffer } satisfies AssetRow);
    await transactionDone(transaction);
  }
  idCache.set(data, id);
  if (idCache.size > 64) {
    const oldest = idCache.keys().next().value;
    if (oldest) idCache.delete(oldest);
  }
  return { id, name, mime, bytes: bytes.length };
}

export const assetRef = (id: string) => `${PREFIX}${id}`;

/** Stores a File/Blob without converting it to base64 first. */
export async function storeAssetBlob(blob: Blob, name: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!bytes.length) throw new Error(`“${name}” is empty.`);
  const id = await hashBytes(bytes);
  const db = await openDatabase();
  const existing = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)) as AssetRow | undefined;
  if (!existing) {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ id, name, mime: blob.type, bytes: bytes.length, data: bytes.buffer } satisfies AssetRow);
    await transactionDone(transaction);
  }
  return { id, name, mime: blob.type, bytes: bytes.length };
}

export async function loadAssetBlob(id: string): Promise<Blob> {
  const db = await openDatabase();
  const row = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)) as AssetRow | undefined;
  if (!row) throw new Error(`Missing local asset ${id.slice(0, 12)}…`);
  const blob = row.data ? new Blob([row.data], { type: row.mime }) : row.blob;
  if (!blob) throw new Error(`Missing local asset ${id.slice(0, 12)}…`);
  return blob;
}

export async function loadAssetDataUrl(id: string) {
  const cached = cache.get(id);
  if (cached) return cached;
  const db = await openDatabase();
  const row = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)) as AssetRow | undefined;
  if (!row) throw new Error(`Missing local asset ${id.slice(0, 12)}…`);
  const blob = row.data ? new Blob([row.data], { type: row.mime }) : row.blob;
  if (!blob) throw new Error(`Missing local asset ${id.slice(0, 12)}…`);
  const data = await blobDataUrl(blob);
  cache.set(id, data);
  if (cache.size > 24) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return data;
}

export async function assetExists(id: string): Promise<boolean> {
  const db = await openDatabase();
  const row = await requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)) as AssetRow | undefined;
  return Boolean(row);
}

export async function persistProjectAssets(project: Project): Promise<Project> {
  const persisted = structuredClone(project);
  for (const element of persisted.overlays ?? []) if (element.source?.startsWith('data:')) { const asset = await storeAssetDataUrl(element.source, element.label ?? 'Overlay'); element.source = `${PREFIX}${asset.id}`; }
  for (const track of persisted.tracks) {
    for (const clip of track.clips) {
      for (const element of clip.elements ?? []) {
        if (element.source?.startsWith('data:')) { const asset = await storeAssetDataUrl(element.source, element.label ?? 'Overlay'); element.source = `${PREFIX}${asset.id}`; }
      }
      if (!clip.image.startsWith('data:')) continue;
      const asset = await storeAssetDataUrl(clip.image, clip.name);
      clip.image = `${PREFIX}${asset.id}`;
    }
  }
  for (const clip of persisted.audio) {
    if (!clip.data.startsWith('data:')) continue;
    const asset = await storeAssetDataUrl(clip.data, clip.name);
    clip.data = `${PREFIX}${asset.id}`;
  }
  return persisted;
}

export async function hydrateProjectAssets(project: Project): Promise<Project> {
  // Assets stay as `pixcut-asset:` references in the live project. The
  // renderer, media tiles and audio elements resolve them on demand, so large
  // photos are never copied into editor state as base64.
  return structuredClone(project);
}

export function isAssetReference(value: string) {
  return value.startsWith(PREFIX);
}
