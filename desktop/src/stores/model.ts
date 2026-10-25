export const FILTER_IDS = ['none', 'vivid', 'warm', 'cool', 'mono', 'film', 'noir', 'dream'] as const;
export type FilterId = typeof FILTER_IDS[number];
export type Scene = {
  id: string;
  name: string;
  image: string;
  duration: number;
  title: string;
  subtitle: string;
  color: string;
  fit: 'cover' | 'contain' | 'blur';
  brightness?: number;
  contrast?: number;
  saturation?: number;
  exposure?: number;
  highlights?: number;
  shadows?: number;
  temperature?: number;
  tint?: number;
  filter?: FilterId;
  filterIntensity?: number;
  speed?: number;
  pitch?: boolean;
  fadeIn?: number;
  fadeOut?: number;
};
export type Project = { schema_version: 1; id: string; name: string; aspect: '16:9' | '9:16' | '1:1' | '4:5'; scenes: Scene[]; policy: { watermark: false; pixcut_outro: false; privacy: 'local' } };
export type Command =
  | { type: 'replace'; project: Project }
  | { type: 'rename'; name: string }
  | { type: 'aspect'; aspect: Project['aspect'] }
  | { type: 'add'; scenes: Scene[] }
  | { type: 'update'; scene: Scene }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; offset: number }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'split'; id: string; at: number; newId: string }
  | { type: 'updateMany'; scenes: Scene[] }
  | { type: 'removeMany'; ids: string[] }
  | { type: 'duplicateMany'; items: { id: string; newId: string }[] }
  | { type: 'undo' } | { type: 'redo' };
export type Session = { project: Project; canUndo: boolean; canRedo: boolean };
export const policy = { watermark: false, pixcut_outro: false, privacy: 'local' } as const;
export const emptyProject = (name = 'Untitled story'): Project => ({ schema_version: 1, id: crypto.randomUUID(), name, aspect: '16:9', scenes: [], policy: { ...policy } });
export const totalDuration = (project: Project) => project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
const optionalNumber = (value: unknown, min: number, max: number) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
const optionalFilter = (value: unknown) => value === undefined || (typeof value === 'string' && (FILTER_IDS as readonly string[]).includes(value));
export function validateProject(value: unknown): Project {
  if (!value || typeof value !== 'object') throw new Error('This is not a PixCut project.');
  const p = value as Project;
  if (p.schema_version !== 1) throw new Error('Unsupported project version. Your original file has not been changed.');
  if (typeof p.id !== 'string' || typeof p.name !== 'string' || p.name.length > 120 || !['16:9', '9:16', '1:1', '4:5'].includes(p.aspect) || !Array.isArray(p.scenes) || p.scenes.length > 100) throw new Error('Invalid project format.');
  const ids = new Set<string>();
  let bytes = 0;
  for (const s of p.scenes) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id) || typeof s.name !== 'string' || typeof s.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(s.image) || !Number.isFinite(s.duration) || s.duration < 0.5 || s.duration > 30 || typeof s.title !== 'string' || s.title.length > 120 || typeof s.subtitle !== 'string' || s.subtitle.length > 200 || !/^#[0-9a-fA-F]{6}$/.test(s.color) || !['cover', 'contain', 'blur'].includes(s.fit) || !optionalNumber(s.brightness, 0, 2.5) || !optionalNumber(s.contrast, 0, 2.5) || !optionalNumber(s.saturation, 0, 2.5) || !optionalNumber(s.exposure, -3, 3) || !optionalNumber(s.highlights, -1, 1) || !optionalNumber(s.shadows, -1, 1) || !optionalNumber(s.temperature, -1, 1) || !optionalNumber(s.tint, -1, 1) || !optionalFilter(s.filter) || !optionalNumber(s.filterIntensity, 0, 100) || !optionalNumber(s.speed, 0.25, 4) || (s.pitch !== undefined && typeof s.pitch !== 'boolean') || !optionalNumber(s.fadeIn, 0, s.duration) || !optionalNumber(s.fadeOut, 0, s.duration)) throw new Error('A scene contains invalid image, timing, title, or color data.');
    ids.add(s.id); bytes += s.image.length;
  }
  if (bytes > 90_000_000) throw new Error('This prototype supports up to 64 MB of embedded images per project.');
  return { ...p, policy: { ...policy } };
}
const SCENE_PATCH_FIELDS = [
  { key: 'duration', value: (scene: Scene) => scene.duration },
  { key: 'title', value: (scene: Scene) => scene.title },
  { key: 'subtitle', value: (scene: Scene) => scene.subtitle },
  { key: 'color', value: (scene: Scene) => scene.color },
  { key: 'fit', value: (scene: Scene) => scene.fit },
  { key: 'brightness', value: (scene: Scene) => scene.brightness ?? 1 },
  { key: 'contrast', value: (scene: Scene) => scene.contrast ?? 1 },
  { key: 'saturation', value: (scene: Scene) => scene.saturation ?? 1 },
  { key: 'exposure', value: (scene: Scene) => scene.exposure ?? 0 },
  { key: 'highlights', value: (scene: Scene) => scene.highlights ?? 0 },
  { key: 'shadows', value: (scene: Scene) => scene.shadows ?? 0 },
  { key: 'temperature', value: (scene: Scene) => scene.temperature ?? 0 },
  { key: 'tint', value: (scene: Scene) => scene.tint ?? 0 },
  { key: 'filter', value: (scene: Scene) => scene.filter ?? 'none' },
  { key: 'filterIntensity', value: (scene: Scene) => scene.filterIntensity ?? 100 },
  { key: 'speed', value: (scene: Scene) => scene.speed ?? 1 },
  { key: 'pitch', value: (scene: Scene) => scene.pitch ?? true },
  { key: 'fadeIn', value: (scene: Scene) => scene.fadeIn ?? 0 },
  { key: 'fadeOut', value: (scene: Scene) => scene.fadeOut ?? 0 },
] as const;
export type ScenePatchKey = typeof SCENE_PATCH_FIELDS[number]['key'];
export function scenePatch(base: Scene, next: Scene): Partial<Scene> {
  const patch: Partial<Scene> = {};
  for (const field of SCENE_PATCH_FIELDS) {
    const before = field.value(base);
    const after = field.value(next);
    if (before !== after) (patch as Record<string, unknown>)[field.key] = after;
  }
  return patch;
}
export function edit(project: Project, command: Exclude<Command, { type: 'undo' } | { type: 'redo' }>): Project {
  let p = structuredClone(project);
  switch (command.type) {
    case 'replace': p = command.project; break;
    case 'rename': p.name = command.name; break;
    case 'aspect': p.aspect = command.aspect; break;
    case 'add': p.scenes.push(...command.scenes); break;
    case 'update': p.scenes = p.scenes.map(s => s.id === command.scene.id ? command.scene : s); break;
    case 'remove': p.scenes = p.scenes.filter(s => s.id !== command.id); break;
    case 'move': { const index = p.scenes.findIndex(s => s.id === command.id); const to = index + command.offset; if (index >= 0 && to >= 0 && to < p.scenes.length) { const [scene] = p.scenes.splice(index, 1); p.scenes.splice(to, 0, scene); } break; }
    case 'duplicate': {
      const index = p.scenes.findIndex(s => s.id === command.id);
      if (index < 0) throw new Error('Select a scene to duplicate.');
      if (p.scenes.some(s => s.id === command.newId)) throw new Error('A scene with this ID already exists.');
      const copy = { ...p.scenes[index], id: command.newId, name: `${p.scenes[index].name} copy` };
      p.scenes.splice(index + 1, 0, copy);
      break;
    }
    case 'split': {
      const index = p.scenes.findIndex(s => s.id === command.id);
      if (index < 0) throw new Error('Select a scene to split.');
      const scene = p.scenes[index];
      if (!Number.isFinite(command.at) || command.at < 0.5 || scene.duration - command.at < 0.5) throw new Error('Move the playhead at least half a second inside the clip to split it.');
      if (p.scenes.some(s => s.id === command.newId)) throw new Error('A scene with this ID already exists.');
      const at = Math.round(command.at * 1000) / 1000;
      const remaining = Math.round((scene.duration - command.at) * 1000) / 1000;
      const left = { ...scene, duration: at, fadeIn: Math.min(scene.fadeIn ?? 0, at), fadeOut: 0 };
      const right = { ...scene, id: command.newId, duration: remaining, fadeIn: 0, fadeOut: Math.min(scene.fadeOut ?? 0, remaining) };
      p.scenes.splice(index, 1, left, right);
      break;
    }
    case 'updateMany': {
      const updates = new Map(command.scenes.map(scene => [scene.id, scene]));
      p.scenes = p.scenes.map(scene => updates.get(scene.id) ?? scene);
      break;
    }
    case 'removeMany': {
      const ids = new Set(command.ids);
      p.scenes = p.scenes.filter(scene => !ids.has(scene.id));
      break;
    }
    case 'duplicateMany': {
      if (new Set(command.items.map(item => item.id)).size !== command.items.length) throw new Error('A scene can only be duplicated once at a time.');
      const existing = new Set(p.scenes.map(scene => scene.id));
      const newIds = new Set<string>();
      for (const item of command.items) {
        if (!existing.has(item.id)) throw new Error('Select a scene to duplicate.');
        if (existing.has(item.newId) || newIds.has(item.newId)) throw new Error('A scene with this ID already exists.');
        newIds.add(item.newId);
      }
      const items = new Map(command.items.map(item => [item.id, item.newId]));
      const next: Scene[] = [];
      for (const scene of p.scenes) {
        next.push(scene);
        const newId = items.get(scene.id);
        if (newId) next.push({ ...scene, id: newId, name: `${scene.name} copy` });
      }
      p.scenes = next;
      break;
    }
  }
  return validateProject(p);
}
export function sceneAt(project: Project, time: number) {
  let start = 0;
  for (const scene of project.scenes) { if (time < start + scene.duration) return { scene, start }; start += scene.duration; }
  const scene = project.scenes.at(-1);
  return scene ? { scene, start: start - scene.duration } : undefined;
}
export function timecode(seconds: number) { const frames = Math.floor(Math.max(0, seconds) * 30); return `${String(Math.floor(frames / 1800)).padStart(2, '0')}:${String(Math.floor(frames / 30) % 60).padStart(2, '0')}:${String(frames % 30).padStart(2, '0')}`; }
