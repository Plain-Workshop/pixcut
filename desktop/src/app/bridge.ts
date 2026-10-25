import { invoke, isTauri } from '@tauri-apps/api/core';
import { edit, emptyProject, validateProject, type Command, type Project, type Session } from '../stores/model';
export const native = isTauri();
let current = emptyProject();
let past: Project[] = [], future: Project[] = [];
function view(): Session { return { project: current, canUndo: past.length > 0, canRedo: future.length > 0 }; }
async function database() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('pixcut-local', 1); request.onupgradeneeded = () => request.result.createObjectStore('projects'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
async function persist(project: Project) { const db = await database(); try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(project, 'recovery'); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); }); } finally { db.close(); } }
export async function initialize(): Promise<Session> {
  if (native) return invoke('initialize');
  const db = await database();
  try { const saved = await new Promise<unknown>((resolve, reject) => { const req = db.transaction('projects').objectStore('projects').get('recovery'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); if (saved) current = validateProject(saved); } finally { db.close(); }
  return view();
}
export async function dispatch(command: Command): Promise<Session> {
  if (native) return invoke('dispatch', { command });
  let next = current; let nextPast = [...past], nextFuture = [...future];
  if (command.type === 'undo') { if (nextPast.length) { nextFuture.push(current); next = nextPast.pop()!; } }
  else if (command.type === 'redo') { if (nextFuture.length) { nextPast.push(current); next = nextFuture.pop()!; } }
  else { next = edit(current, command); nextPast.push(current); nextPast = nextPast.slice(-30); nextFuture = []; }
  await persist(next); current = next; past = nextPast; future = nextFuture;
  return view();
}
export async function saveProject(project: Project): Promise<boolean> {
  if (native) return invoke('save_project');
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${project.name.replace(/[^\p{L}\p{N} _-]/gu, '') || 'Project'}.pixcut.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
}
export async function openProject(): Promise<Session | null> { return invoke('open_project'); }
export async function exporterAvailable(): Promise<boolean> { return native ? invoke('exporter_available') : false; }
export async function exportMovie(projectId: string, frames: string[]): Promise<string | null> { return invoke('export_movie', { projectId, frames }); }
