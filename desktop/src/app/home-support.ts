import type { Project } from '../stores/model';
import { frameRate, totalDuration } from '../stores/model';

export type DiagnosticsInput = {
  appVersion: string;
  buildSha: string;
  buildDate: string;
  native: boolean;
  platform: string;
  project: Pick<Project, 'schema_version' | 'aspect' | 'timebase'> & Parameters<typeof totalDuration>[0];
  exporter: boolean;
  preferences: { compact: boolean; reduceMotion: boolean; autosaveMs: number };
};

/** The text "Copy diagnostics" puts on the clipboard: versions and settings only, never project content. */
export function buildDiagnostics(input: DiagnosticsInput): string {
  const { project, preferences } = input;
  return [
    `PixCut Desktop ${input.appVersion}`,
    `Build: ${input.buildSha.slice(0, 7)} · ${input.buildDate}`,
    `Runtime: ${input.native ? 'native Tauri' : 'browser preview'}`,
    `Platform: ${input.platform}`,
    `Project schema: ${project.schema_version}`,
    `Project: ${project.aspect} · ${frameRate(project.timebase).toFixed(0)} fps · ${totalDuration(project).toFixed(1)} s`,
    `FFmpeg: ${input.exporter ? 'available' : 'not found'}`,
    `Preferences: ${preferences.compact ? 'compact' : 'comfortable'} · ${preferences.reduceMotion ? 'reduced motion' : 'full motion'} · autosave ${preferences.autosaveMs} ms`,
  ].join('\n');
}

type Named = { name: string; type: string };

export type DropAction<F extends Named> =
  | { kind: 'project'; file: F }
  | { kind: 'images'; files: F[] }
  | { kind: 'videos'; files: F[] }
  | { kind: 'unsupported' };

/** What dropping these files on Home should do: a .pixcut project wins, then photos, then videos. */
export function classifyDrop<F extends Named>(files: readonly F[]): DropAction<F> {
  const project = files.find(file => /\.pixcut$/i.test(file.name));
  if (project) return { kind: 'project', file: project };
  const images = files.filter(file => /^image\//.test(file.type));
  if (images.length) return { kind: 'images', files: images };
  const videos = files.filter(file => /^video\//.test(file.type));
  if (videos.length) return { kind: 'videos', files: videos };
  return { kind: 'unsupported' };
}

const ASSET_PREFIX = 'pixcut-asset:';

export type MissingCountDeps = {
  /** The saved project for a library entry, or null if it is gone. */
  load: (id: string) => Promise<Project | null>;
  refsOf: (project: Project) => string[];
  /** Native: asks the shell which references are missing from disk. */
  nativeMissing: ((refs: string[]) => Promise<string[]>) | null;
  /** Browser: whether one stored asset id still exists. */
  exists: (assetId: string) => Promise<boolean>;
  isCancelled: () => boolean;
};

/**
 * How many media files each listed project has lost, for the badge on its card.
 * Looks at the first `limit` projects only, skips projects it cannot read, and
 * stops (returning null) as soon as it is cancelled.
 */
export async function countMissingAssets(entries: readonly { id: string }[], deps: MissingCountDeps, limit = 12): Promise<Record<string, number> | null> {
  const found: Record<string, number> = {};
  for (const entry of entries.slice(0, limit)) {
    try {
      const saved = await deps.load(entry.id);
      const refs = saved ? deps.refsOf(saved) : [];
      if (!refs.length) continue;
      const lost = deps.nativeMissing
        ? await deps.nativeMissing(refs)
        : (await Promise.all(refs.map(async reference => await deps.exists(reference.slice(ASSET_PREFIX.length)) ? null : reference))).filter((reference): reference is string => Boolean(reference));
      if (lost.length) found[entry.id] = lost.length;
    } catch { /* a card without a badge is better than a failed library */ }
    if (deps.isCancelled()) return null;
  }
  return deps.isCancelled() ? null : found;
}
