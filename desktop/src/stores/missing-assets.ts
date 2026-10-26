import type { Project } from './model';

const REF = /^pixcut-asset:[0-9a-f]{64}$/;

export type MissingMediaKind = 'image' | 'video' | 'audio';
export type MissingAsset = { ref: string; kind: MissingMediaKind; label: string };

function isRef(value: string | undefined): value is string {
  return typeof value === 'string' && REF.test(value);
}

/**
 * Collects asset references that survived hydration, which means the local
 * store no longer has the bytes. One entry per reference keeps the relink list
 * short even when a file is reused by several scenes.
 */
/** Every asset reference the project uses, once each. */
export function projectAssetRefs(project: Project): string[] {
  const refs = new Set<string>();
  const add = (source: string | undefined) => { if (isRef(source)) refs.add(source); };
  for (const element of project.overlays ?? []) add(element.source);
  for (const track of project.tracks) {
    for (const scene of track.clips) {
      for (const element of scene.elements ?? []) add(element.source);
      add(scene.image);
    }
  }
  for (const clip of project.audio) add(clip.data);
  return [...refs];
}

/**
 * `present` lists references the local store confirmed it still has. Video is
 * intentionally kept as a reference on native, so presence has to be checked
 * rather than assumed from the reference surviving hydration.
 */
export function missingAssets(project: Project, present: ReadonlySet<string> = new Set()): MissingAsset[] {
  const found = new Map<string, MissingAsset>();
  const add = (source: string | undefined, kind: MissingMediaKind, label: string) => {
    if (!isRef(source) || found.has(source) || present.has(source)) return;
    found.set(source, { ref: source, kind, label: label.trim() || 'Untitled media' });
  };
  for (const element of project.overlays ?? []) add(element.source, element.kind === 'video' ? 'video' : 'image', element.label ?? element.kind);
  for (const track of project.tracks) {
    for (const scene of track.clips) {
      for (const element of scene.elements ?? []) add(element.source, element.kind === 'video' ? 'video' : 'image', element.label ?? element.kind);
      add(scene.image, scene.mediaKind === 'video' ? 'video' : 'image', scene.name);
    }
  }
  for (const clip of project.audio) add(clip.data, 'audio', clip.name);
  return [...found.values()];
}

/** Replaces every use of one reference with freshly imported media bytes. */
export function replaceAssetRef(project: Project, ref: string, data: string): Project {
  const next = structuredClone(project);
  const swap = (value: string | undefined) => value === ref ? data : value;
  for (const element of next.overlays ?? []) element.source = swap(element.source);
  for (const track of next.tracks) {
    for (const scene of track.clips) {
      for (const element of scene.elements ?? []) element.source = swap(element.source);
      scene.image = swap(scene.image) ?? scene.image;
    }
  }
  for (const clip of next.audio) clip.data = swap(clip.data) ?? clip.data;
  return next;
}
