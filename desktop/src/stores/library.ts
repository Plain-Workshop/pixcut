import { isTrashExpired } from './trash';
import { projectFingerprint } from './fingerprint';
import { DEFAULT_TIMEBASE, normalizeStarts, overlayScenes, projectScenes, sceneSeconds, ticksToSeconds, totalDuration, validateProject, type Project, type Timebase } from './model';
import { hydrateProjectAssets, persistProjectAssets } from './assets';
import { drawPipClips, drawProjectText, drawScene } from '../components/preview/render';
import { resolveSceneForFormat } from './formats';
import { projectAssetRefs } from './missing-assets';
import * as bridge from '../app/bridge';
import { parseIndexedSummaries } from './library-index';

export type ProjectSummary = {
  id: string;
  name: string;
  aspect: Project['aspect'];
  width?: number;
  height?: number;
  timebase?: Timebase;
  sceneCount: number;
  duration: number;
  createdAt: number;
  updatedAt: number;
  thumbnail: string;
  group?: string;
  favorite?: boolean;
  /** Every deliverable the project holds, so cards can show them. */
  formats?: { name: string; width: number; height: number; aspect: string }[];
  /** When a video of this project was last exported on this device. */
  exportedAt?: number;
  /** Fingerprints of the project as last saved and as last exported; equal means no edits since the export. */
  /** Set while the project sits in Recently deleted. Its body and media are kept until it expires. */
  deletedAt?: number;
  contentHash?: string;
  exportedHash?: string;
  /** Small scene previews for hover scrubbing, drawn on first hover and cleared whenever the project is saved. */
  frames?: string[];
};

type ProjectRow = { id: string; project: Project };
const DB_NAME = 'pixcut-library';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const META = 'meta';
let database: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
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

export async function projectThumbnail(project: Project) {
  const scene = projectScenes(project)[0];
  if (!scene) return '';
  return sceneThumbnail(project, scene);
}

async function sceneThumbnail(project: Project, scene: ReturnType<typeof projectScenes>[number], maxWidth = 0) {
  const canvas = document.createElement('canvas');
  const format = project.formats?.[0];
  const resolved = resolveSceneForFormat(scene, format);
  const thumbSeconds = Math.min(1.1, sceneSeconds(scene, project.timebase) * .35);
  await drawScene(canvas, resolved, project.aspect, 'thumb', thumbSeconds, project.timebase, format ? { width: format.width, height: format.height } : undefined, undefined, project.audio, project.overlays ?? [], ticksToSeconds(scene.startTicks, project.timebase) + thumbSeconds);
  await drawPipClips(canvas, overlayScenes(project), ticksToSeconds(scene.startTicks, project.timebase) + thumbSeconds, project.aspect, 'thumb', project.timebase, project.audio);
  await drawProjectText(canvas, project.globalText ?? [], ticksToSeconds(scene.startTicks, project.timebase) + thumbSeconds, project.timebase);
  if (maxWidth && canvas.width > maxWidth) {
    const small = document.createElement('canvas');
    small.width = maxWidth;
    small.height = Math.max(1, Math.round(canvas.height * maxWidth / canvas.width));
    small.getContext('2d')?.drawImage(canvas, 0, 0, small.width, small.height);
    return small.toDataURL('image/jpeg', .7);
  }
  return canvas.toDataURL('image/jpeg', .76);
}

const FRAME_COUNT = 6;
const pendingExports = new Map<string, { at: number; hash: string }>();

/** Up to six scenes spread across the project, as small previews. */
export async function projectFrames(project: Project, count = FRAME_COUNT): Promise<string[]> {
  const scenes = projectScenes(project);
  if (!scenes.length) return [];
  const picked = scenes.length <= count ? scenes : Array.from({ length: count }, (_, index) => scenes[Math.round(index * (scenes.length - 1) / (count - 1))]);
  const frames: string[] = [];
  for (const scene of picked) {
    try { const frame = await sceneThumbnail(project, scene, 240); if (frame) frames.push(frame); } catch { /* skip a scene that cannot be drawn */ }
  }
  return frames;
}

/** Returns the hover previews for a project, drawing and caching them on first use. */
export async function loadProjectFrames(id: string): Promise<string[]> {
  const summary = await readSummary(id);
  if (!summary) return [];
  if (summary.frames?.length) return summary.frames;
  const project = await getLibraryProject(id);
  if (!project) return [];
  const frames = await projectFrames(project);
  if (!frames.length) return [];
  const latest = await readSummary(id);
  // A save in the meantime cleared the cache for a reason; do not write stale frames over it.
  if (!latest || latest.updatedAt !== summary.updatedAt) return frames;
  const db = await openDatabase();
  const write = db.transaction(META, 'readwrite');
  write.objectStore(META).put({ ...latest, frames });
  await transactionDone(write);
  return frames;
}

/** Records that a video of the project was exported. Held until the first save if the project is not in the library yet. */
export async function markProjectExported(id: string, hash: string) {
  const at = Date.now();
  const summary = await readSummary(id);
  if (!summary) { pendingExports.set(id, { at, hash }); return; }
  const next = { ...summary, exportedAt: at, exportedHash: hash };
  const db = await openDatabase();
  const write = db.transaction(META, 'readwrite');
  write.objectStore(META).put(next);
  await transactionDone(write);
  await syncIndex(next);
}

function summaryFrom(project: Project, createdAt: number, thumbnail: string, group?: string, favorite?: boolean, exportedAt?: number, exportedHash?: string): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    aspect: project.aspect,
    width: project.formats?.[0]?.width,
    height: project.formats?.[0]?.height,
    timebase: project.timebase ?? DEFAULT_TIMEBASE,
    sceneCount: projectScenes(project).length,
    duration: totalDuration(project),
    createdAt,
    updatedAt: Date.now(),
    thumbnail,
    formats: (project.formats ?? []).map(format => ({ name: format.name, width: format.width, height: format.height, aspect: format.aspect })),
    ...(group ? { group } : {}),
    ...(favorite ? { favorite } : {}),
    contentHash: projectFingerprint(project),
    ...(exportedAt ? { exportedAt } : {}),
    ...(exportedHash ? { exportedHash } : {}),
  };
}

/**
 * The native SQLite catalog mirrors summaries so listing does not read every
 * project record. A failure clears the catalog (the IndexedDB copy is still the
 * source of truth), so the next list rebuilds it instead of showing stale rows.
 */
async function syncIndex(summary: ProjectSummary): Promise<void> {
  if (!bridge.native) return;
  try {
    await bridge.libraryIndexUpsert([{ id: summary.id, name: summary.name, updatedAt: summary.updatedAt, summary: JSON.stringify({ ...summary, frames: undefined }) }]);
  } catch {
    await bridge.libraryIndexClear().catch(() => {});
  }
}

async function syncIndexes(summaries: ProjectSummary[]): Promise<void> {
  if (!bridge.native || !summaries.length) return;
  try {
    await bridge.libraryIndexUpsert(summaries.map(summary => ({ id: summary.id, name: summary.name, updatedAt: summary.updatedAt, summary: JSON.stringify({ ...summary, frames: undefined }) })));
  } catch {
    await bridge.libraryIndexClear().catch(() => {});
  }
}

async function removeFromIndex(id: string): Promise<void> {
  if (!bridge.native) return;
  try {
    await bridge.libraryIndexRemove(id);
  } catch {
    await bridge.libraryIndexClear().catch(() => {});
  }
}

export async function setProjectFavorite(id: string, favorite: boolean) {
  const db = await openDatabase();
  const read = db.transaction(META, 'readonly');
  const summary = await requestResult(read.objectStore(META).get(id)) as ProjectSummary | undefined;
  if (!summary) return;
  if (favorite) summary.favorite = true;
  else delete summary.favorite;
  const write = db.transaction(META, 'readwrite');
  write.objectStore(META).put(summary);
  await transactionDone(write);
  await syncIndex(summary);
}

export async function renameProjectGroup(from: string, to: string) {
  const name = to.trim();
  if (!name || name === from) return;
  const db = await openDatabase();
  const read = db.transaction(META, 'readonly');
  const rows = await requestResult(read.objectStore(META).getAll()) as ProjectSummary[];
  const write = db.transaction(META, 'readwrite');
  const store = write.objectStore(META);
  const changed: ProjectSummary[] = [];
  for (const summary of rows) {
    if (summary.group !== from) continue;
    summary.group = name;
    store.put(summary);
    changed.push(summary);
  }
  await transactionDone(write);
  await syncIndexes(changed);
}

export async function deleteProjectGroup(group: string) {
  const db = await openDatabase();
  const read = db.transaction(META, 'readonly');
  const rows = await requestResult(read.objectStore(META).getAll()) as ProjectSummary[];
  const write = db.transaction(META, 'readwrite');
  const store = write.objectStore(META);
  const changed: ProjectSummary[] = [];
  for (const summary of rows) {
    if (summary.group !== group) continue;
    delete summary.group;
    store.put(summary);
    changed.push(summary);
  }
  await transactionDone(write);
  await syncIndexes(changed);
}

export async function setProjectGroup(id: string, group: string | null) {
  const db = await openDatabase();
  const read = db.transaction(META, 'readonly');
  const summary = await requestResult(read.objectStore(META).get(id)) as ProjectSummary | undefined;
  if (!summary) return;
  if (group?.trim()) summary.group = group.trim();
  else delete summary.group;
  const write = db.transaction(META, 'readwrite');
  write.objectStore(META).put(summary);
  await transactionDone(write);
  await syncIndex(summary);
}

async function readSummary(id: string): Promise<ProjectSummary | undefined> {
  const db = await openDatabase();
  const transaction = db.transaction(META, 'readonly');
  return requestResult(transaction.objectStore(META).get(id)) as Promise<ProjectSummary | undefined>;
}

async function listLocalProjects(): Promise<ProjectSummary[]> {
  const db = await openDatabase();
  const transaction = db.transaction(META, 'readonly');
  const rows = await requestResult(transaction.objectStore(META).getAll()) as ProjectSummary[];
  return rows.filter(row => !row.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function countLocalProjects(): Promise<number> {
  const db = await openDatabase();
  const transaction = db.transaction(META, 'readonly');
  const rows = await requestResult(transaction.objectStore(META).getAll()) as ProjectSummary[];
  return rows.filter(row => !row.deletedAt).length;
}

/** Projects in Recently deleted, newest deletion first. Expired ones are removed for good as they are found. */
export async function listDeletedProjects(): Promise<ProjectSummary[]> {
  const db = await openDatabase();
  const transaction = db.transaction(META, 'readonly');
  const rows = await requestResult(transaction.objectStore(META).getAll()) as ProjectSummary[];
  const deleted = rows.filter(row => row.deletedAt);
  const expired = deleted.filter(row => isTrashExpired(row.deletedAt ?? 0));
  for (const row of expired) await deleteLibraryProject(row.id).catch(() => {});
  return deleted.filter(row => !expired.includes(row)).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)).map(row => ({ ...row, frames: undefined }));
}

/** Moves a project to Recently deleted. Nothing is erased, so it can still be restored. */
export async function trashLibraryProject(id: string) {
  const summary = await readSummary(id);
  if (!summary) return;
  const db = await openDatabase();
  const write = db.transaction(META, 'readwrite');
  write.objectStore(META).put({ ...summary, deletedAt: Date.now() });
  await transactionDone(write);
  await removeFromIndex(id);
}

export async function restoreLibraryProject(id: string) {
  const summary = await readSummary(id);
  if (!summary) return;
  const { deletedAt: _deletedAt, ...restored } = summary;
  const db = await openDatabase();
  const write = db.transaction(META, 'readwrite');
  write.objectStore(META).put(restored);
  await transactionDone(write);
  await syncIndex(restored);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  if (bridge.native) {
    try {
      const [rows, localCount] = await Promise.all([bridge.libraryIndexList(), countLocalProjects()]);
      // The catalog must mirror the project store exactly. A mismatch (a fresh
      // install, a cleared webview or a partially failed write) rebuilds it
      // from IndexedDB, which remains the source of truth.
      if (rows.length && rows.length === localCount) return parseIndexedSummaries(rows);
      const local = await listLocalProjects();
      await bridge.libraryIndexClear().catch(() => {});
      await syncIndexes(local);
      return local;
    } catch { /* fall back to IndexedDB below */ }
  }
  return listLocalProjects();
}

const backfillTried = new Set<string>();

/**
 * Redraws missing card previews for saved projects (for example ones whose
 * thumbnail was blocked before native images were read as blobs). Only the
 * summary changes: the project body and its `updatedAt` stay as they were, so
 * the Recent order does not move. Each project is tried once per session.
 * Returns the refreshed summaries, or null when nothing changed.
 */
export async function backfillThumbnails(summaries: ProjectSummary[], limit = 12): Promise<ProjectSummary[] | null> {
  const missing = summaries.filter(item => !item.thumbnail && !backfillTried.has(item.id)).slice(0, limit);
  if (!missing.length) return null;
  const updated = new Map<string, ProjectSummary>();
  for (const item of missing) {
    backfillTried.add(item.id);
    try {
      const project = await getLibraryProject(item.id);
      if (!project) continue;
      const thumbnail = await projectThumbnail(project);
      if (!thumbnail) continue;
      const next = { ...item, thumbnail };
      const db = await openDatabase();
      const write = db.transaction(META, 'readwrite');
      write.objectStore(META).put(next);
      await transactionDone(write);
      await syncIndex(next);
      updated.set(item.id, next);
    } catch { /* leave the placeholder; it is retried next session */ }
  }
  return updated.size ? summaries.map(item => updated.get(item.id) ?? item) : null;
}

export async function getLibraryProject(id: string): Promise<Project | null> {
  const db = await openDatabase();
  const transaction = db.transaction(PROJECTS, 'readonly');
  const row = await requestResult(transaction.objectStore(PROJECTS).get(id)) as ProjectRow | undefined;
  if (!row?.project) {
    // The catalog outlived its body (for example after clearing webview data).
    // Drop the stale card instead of leaving an unopenable project.
    await removeFromIndex(id);
    return null;
  }
  const validated = validateProject(row.project);
  const persisted = await persistProjectAssets(validated);
  if (JSON.stringify(persisted) !== JSON.stringify(validated)) {
    const write = db.transaction(PROJECTS, 'readwrite');
    write.objectStore(PROJECTS).put({ id, project: persisted } satisfies ProjectRow);
    await transactionDone(write);
  }
  return hydrateProjectAssets(persisted);
}

export async function saveLibraryProject(project: Project): Promise<ProjectSummary | null> {
  const hydrated = await hydrateProjectAssets(project);
  if (!projectScenes(hydrated).length) {
    await deleteLibraryProject(project.id);
    return null;
  }
  const persisted = await persistProjectAssets(hydrated);
  const previous = await readSummary(project.id);
  const thumbnail = await projectThumbnail(hydrated).catch(() => '');
  const summary = summaryFrom(hydrated, previous?.createdAt ?? Date.now(), thumbnail, previous?.group, previous?.favorite, previous?.exportedAt ?? pendingExports.get(project.id)?.at, previous?.exportedHash ?? pendingExports.get(project.id)?.hash);
  pendingExports.delete(project.id);
  const db = await openDatabase();
  const transaction = db.transaction([PROJECTS, META], 'readwrite');
  transaction.objectStore(PROJECTS).put({ id: project.id, project: persisted } satisfies ProjectRow);
  transaction.objectStore(META).put(summary);
  await transactionDone(transaction);
  await syncIndex(summary);
  return summary;
}

export async function deleteLibraryProject(id: string) {
  const db = await openDatabase();
  const transaction = db.transaction([PROJECTS, META], 'readwrite');
  transaction.objectStore(PROJECTS).delete(id);
  transaction.objectStore(META).delete(id);
  await transactionDone(transaction);
  await removeFromIndex(id);
}

export async function duplicateLibraryProject(id: string) {
  const project = await getLibraryProject(id);
  if (!project) return null;
  const copy: Project = structuredClone(project);
  copy.id = crypto.randomUUID();
  copy.name = `${project.name} copy`;
  for (const track of copy.tracks) {
    track.clips = track.clips.map(scene => ({ ...scene, id: crypto.randomUUID() }));
    normalizeStarts(track.clips);
  }
  return saveLibraryProject(copy);
}

/**
 * Every stored asset reference used by any project in the local library. Used by
 * storage cleanup so saved projects never lose their media.
 */
export async function libraryAssetRefs(): Promise<string[]> {
  const db = await openDatabase();
  const read = db.transaction(PROJECTS, 'readonly');
  const rows = await requestResult(read.objectStore(PROJECTS).getAll()) as ProjectRow[];
  const refs = new Set<string>();
  for (const row of rows) {
    if (!row?.project) continue;
    for (const ref of projectAssetRefs(row.project)) refs.add(ref);
  }
  return [...refs];
}

/** Whether a card should say the project changed after its last export. */
export function exportState(summary: Pick<ProjectSummary, 'exportedAt' | 'contentHash' | 'exportedHash'>): 'never' | 'current' | 'changed' {
  if (!summary.exportedAt) return 'never';
  // Exports recorded before fingerprints existed cannot be compared, so they read as current.
  if (!summary.exportedHash || !summary.contentHash) return 'current';
  return summary.exportedHash === summary.contentHash ? 'current' : 'changed';
}
