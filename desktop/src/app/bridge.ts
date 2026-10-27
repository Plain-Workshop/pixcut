import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { edit, emptyProject, trimHistory, validateProject, type Command, type Project, type Session } from '../stores/model';
import { persistProjectAssets } from '../stores/assets';
import { projectToPixcut } from '../stores/pixcut-bundle';
export const native = isTauri();
let current = emptyProject();
let past: Project[] = [], future: Project[] = [];
function view(): Session { return { project: current, canUndo: past.length > 0, canRedo: future.length > 0 }; }
async function database() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('pixcut-local', 1); request.onupgradeneeded = () => request.result.createObjectStore('projects'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function persist(project: Project) { const persisted = await persistProjectAssets(project); const db = await database(); try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(persisted, 'recovery'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); } return persisted; }
export async function initialize(): Promise<Session> {
  if (native) return invoke('initialize');
  const db = await database();
  try { const saved = await new Promise<unknown>((resolve, reject) => { const req = db.transaction('projects').objectStore('projects').get('recovery'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); if (saved) { const validated = validateProject(saved); const persisted = await persistProjectAssets(validated); current = persisted; const legacy = (saved as { schema_version?: number }).schema_version !== 14 || JSON.stringify(persisted) !== JSON.stringify(validated); if (legacy) await persist(current); } } finally { db.close(); }
  return view();
}
export async function dispatch(command: Command): Promise<Session> {
  if (native) return invoke('dispatch', { command });
  let next = current; let nextPast = [...past], nextFuture = [...future];
  if (command.type === 'undo') { if (nextPast.length) { nextFuture.push(current); next = nextPast.pop()!; } }
  else if (command.type === 'redo') { if (nextFuture.length) { nextPast.push(current); next = nextFuture.pop()!; } }
  else { next = edit(current, command); nextPast = trimHistory([...nextPast, current]); nextFuture = []; }
  const persisted = await persist(next); current = persisted; past = nextPast; future = nextFuture;
  return view();
}
export type History = { canUndo: boolean; canRedo: boolean };
/**
 * A stack-order press. The answer is only the undo/redo flags: everything the
 * editor needs to redraw is already local, so this never ships a project's media
 * to Rust and back (which is what made the buttons feel stuck on big stories).
 */
export async function applyOrder(command: Command): Promise<History> {
  if (native) return invoke('apply_order', { command });
  const view = await dispatch(command);
  return { canUndo: view.canUndo, canRedo: view.canRedo };
}
async function downloadProject(project: Project) {
  const data = await projectToPixcut(project);
  const blob = new Blob([data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^\p{L}\p{N} _-]/gu, '') || 'Project'}.pixcut`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export async function saveProject(project: Project): Promise<boolean> {
  if (native) return invoke('save_project');
  return downloadProject(project);
}
export async function exportProjectFile(project: Project): Promise<boolean> {
  if (native) return invoke('save_project_file', { project });
  return downloadProject(project);
}
export async function saveStillFrame(data: string, fileName: string): Promise<boolean> {
  if (native) return invoke('save_still_frame', { data, fileName });
  const link = document.createElement('a');
  link.href = data;
  link.download = `${fileName.replace(/[^\p{L}\p{N} _-]/gu, '') || 'PixCut frame'}.png`;
  link.click();
  return true;
}
export function onProjectOpened(handler: () => void): Promise<UnlistenFn> | null {
  return native ? listen('project-opened', handler) : null;
}
export async function takePendingProject(): Promise<Session | null> {
  return native ? invoke('take_pending_project') : null;
}
export async function openProject(): Promise<Session | null> { return invoke('open_project'); }
export async function exporterAvailable(): Promise<boolean> { return native ? invoke('exporter_available') : false; }
export type PickedMedia = { name: string; mime: string; data: string };
export async function pickMedia(kind: 'image' | 'audio' | 'video'): Promise<PickedMedia[] | null> { return native ? invoke('pick_media', { kind }) : null; }
export type ExportCodec = 'h264' | 'hevc' | 'vp9' | 'prores';
export type ExportContainer = 'mp4' | 'mov' | 'mkv' | 'webm';
export async function exporterHardware(): Promise<boolean> { return native ? invoke('exporter_hardware') : false; }
export async function exporterCapabilities(): Promise<ExportCodec[]> { return native ? invoke('exporter_capabilities') : ['h264', 'hevc', 'vp9', 'prores']; }
export type ExportOptions = { codec?: ExportCodec; container?: ExportContainer; speed?: 'fast' | 'medium' | 'slow'; hardware?: boolean; width: number; height: number; fps: number; crf: number; filename: string };
export type ExportJob = { frames: string[]; durations: number[]; options: ExportOptions };
export type PlanOverlay = { png: string; frames?: string[]; startTicks: number; durationTicks: number };
export type PlanSegment = { kind: 'image' | 'video'; png?: string; video?: string; sourceInSeconds?: number; fit?: 'cover' | 'contain' | 'blur'; speed?: number; /** End rate of a linear ramp; omitted for constant speed. */ speedEnd?: number; reverse?: boolean; lut?: string; fadeIn?: number; fadeOut?: number; videoVolume?: number; includeAudio?: boolean; durationTicks: number; /** Clip sound can outlast a shortened visual segment while a transition runs. */ audioDurationTicks?: number; overlays: PlanOverlay[] };
export type ExportPlan = { segments: PlanSegment[]; options: ExportOptions };
export async function exportMovie(projectId: string, frames: string[], durations: number[], options: ExportOptions): Promise<string | null> { return invoke('export_movie', { projectId, frames, durations, options }); }
export async function exportVariants(projectId: string, jobs: ExportJob[], snapshot?: Project): Promise<string[]> { return invoke('export_variants', { projectId, jobs, snapshot }); }
export async function exportPlanVariants(projectId: string, plans: ExportPlan[], snapshot?: Project): Promise<string[]> { return invoke('export_plan_variants', { projectId, plans, snapshot }); }
export async function cancelExport(): Promise<void> { if (native) await invoke('cancel_export'); }
export function onExportProgress(handler: (percent: number) => void): Promise<UnlistenFn> | null { return native ? listen<number>('export-progress', event => handler(event.payload)) : null; }

export type UpdateInfo = { version: string; currentVersion: string; notes: string; date: string | null };
type PendingUpdate = Awaited<ReturnType<typeof import('@tauri-apps/plugin-updater')['check']>>;
let pendingUpdate: PendingUpdate = null;

export type LibraryIndexEntry = { id: string; name: string; updatedAt: number; summary: string };

export async function libraryIndexList(): Promise<string[]> {
  return native ? invoke<string[]>('library_index_list') : [];
}
export async function libraryIndexUpsert(entries: LibraryIndexEntry[]): Promise<void> {
  if (native && entries.length) await invoke('library_index_upsert', { entries });
}
export async function libraryIndexRemove(id: string): Promise<void> {
  if (native) await invoke('library_index_remove', { id });
}
export async function libraryIndexClear(): Promise<void> {
  if (native) await invoke('library_index_clear');
}

export async function setAppMenu(language: string): Promise<void> {
  if (native) await invoke('set_app_menu', { language });
}

export async function appVersion(): Promise<string | null> {
  if (!native) return null;
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion();
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!native) throw new Error('Updates are available in the desktop app.');
  const { check } = await import('@tauri-apps/plugin-updater');
  pendingUpdate = await check();
  if (!pendingUpdate) return null;
  const update = pendingUpdate;
  return { version: update.version, currentVersion: update.currentVersion, notes: update.body ?? '', date: update.date ?? null };
}

export async function installUpdate(onProgress: (percent: number) => void): Promise<void> {
  if (!native) throw new Error('Updates are available in the desktop app.');
  if (!pendingUpdate) {
    const { check } = await import('@tauri-apps/plugin-updater');
    pendingUpdate = await check();
  }
  if (!pendingUpdate) throw new Error('PixCut is already up to date.');
  const update = pendingUpdate;
  let total = 0, received = 0;
  await update.downloadAndInstall(event => {
    if (event.event === 'Started') { total = event.data.contentLength ?? 0; received = 0; onProgress(0); }
    else if (event.event === 'Progress') { received += event.data.chunkLength; onProgress(total ? Math.min(99, Math.round((received / total) * 100)) : 50); }
    else if (event.event === 'Finished') onProgress(100);
  });
  pendingUpdate = null;
}

export async function restartToUpdate(): Promise<void> {
  if (!native) throw new Error('Restart is available in the desktop app.');
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}

export type ImportedMedia = { reference: string; name: string; bytes: number };
/** Native only: streams the picked media into the local asset store. */
export async function importVideoAsset(): Promise<ImportedMedia | null> { return native ? invoke('import_video') : null; }
export async function importAudioAsset(): Promise<ImportedMedia | null> { return native ? invoke('import_audio') : null; }
export type ImportedImage = { reference: string; name: string; bytes: number };
export type ImportedAsset = { reference: string; name: string; bytes: number; mime: string };
export async function importMediaAsset(): Promise<ImportedAsset | null> { return native ? invoke('import_media') : null; }
export async function importMediaPath(path: string): Promise<ImportedAsset> { return invoke('import_media_path', { path }); }
export type NativeDragDrop =
  | { type: 'enter' | 'over'; position: { x: number; y: number }; paths?: string[] }
  | { type: 'drop'; position: { x: number; y: number }; paths: string[] }
  | { type: 'leave' };
export function onDragDrop(handler: (event: NativeDragDrop) => void): Promise<UnlistenFn> | null {
  if (!native) return null;
  return import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) =>
    getCurrentWebviewWindow().onDragDropEvent(event => handler(event.payload as NativeDragDrop)),
  );
}
export async function importImagesAsset(): Promise<ImportedImage[]> { return native ? invoke('import_images') : []; }

export async function missingAssetRefs(references: string[]): Promise<string[]> { return native ? invoke('missing_asset_refs', { references }) : references; }

export function onMenu(handler: (id: string) => void): Promise<UnlistenFn> | null { return native ? listen<string>('menu', event => handler(event.payload)) : null; }

export type AssetUsage = { files: number; bytes: number };
export async function assetUsage(): Promise<AssetUsage> { return native ? invoke('asset_usage') : { files: 0, bytes: 0 }; }
export async function referencedRefs(): Promise<string[]> { return native ? invoke('referenced_refs') : []; }
export async function pruneAssets(keep: string[]): Promise<AssetUsage> { return native ? invoke('prune_assets', { keep }) : { files: 0, bytes: 0 }; }

export async function saveTextFile(data: string, fileName: string, extension: string, label: string): Promise<boolean> {
  if (native) return invoke('save_text_file', { data, fileName, extension, label });
  const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName.replace(/[^\p{L}\p{N} _-]/gu, '') || 'PixCut'}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
