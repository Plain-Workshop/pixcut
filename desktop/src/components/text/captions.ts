import { MAX_TEXT_LAYERS, createTextLayer, legacyTextLayer } from './layers';
import { secondsToTicks, type Scene, type TextLayer, type Timebase } from '../../stores/model';

/**
 * Caption import is fully local: an SRT or WebVTT file is parsed here and turned
 * into ordinary text layers, so every caption can be restyled, retimed, or
 * deleted like any other title. Nothing is uploaded and no speech model is used.
 */
export type CaptionCue = { start: number; end: number; text: string };

export type CaptionPlacement = {
  /** Text layers created. */
  added: number;
  /** Cues that needed more than one layer because they were long. */
  split: number;
  /** Cues that fell outside the timeline or hit the per-scene layer cap. */
  skipped: number;
  /** Scenes that received at least one caption. */
  scenes: number;
};

export const CAPTION_TEXT_LIMIT = 110;
const MAX_CUES = 4000;

const TIMESTAMP = /(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{1,3})/;

function timestampSeconds(match: RegExpMatchArray, offset: number): number {
  const hours = match[offset] ? Number(match[offset]) : 0;
  const minutes = Number(match[offset + 1]);
  const seconds = Number(match[offset + 2]);
  const fraction = Number(`0.${match[offset + 3].padEnd(3, '0')}`);
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

function cleanCueText(lines: string[]): string {
  return lines
    .join(' ')
    .replace(/<[^>]*>/g, ' ')            // <i>, <b>, <c.color>, <v Speaker>
    .replace(/\{\\[^}]*\}/g, ' ')        // ASS overrides such as {\an8}
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parses SRT and WebVTT text. Throws a readable error instead of returning junk. */
export function parseCaptions(source: string): CaptionCue[] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('That caption file is empty.');
  const blocks = text.split(/\n{2,}/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim().length > 0);
    if (!lines.length || /^WEBVTT\b/i.test(lines[0]) || /^NOTE\b/i.test(lines[0])) continue;
    const index = lines.findIndex(line => TIMESTAMP.test(line));
    if (index < 0) continue;
    const match = lines[index].match(TIMESTAMP);
    if (!match) continue;
    const start = timestampSeconds(match, 1);
    const end = timestampSeconds(match, 5);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const body = cleanCueText(lines.slice(index + 1));
    if (!body) continue;
    cues.push({ start, end, text: body });
    if (cues.length > MAX_CUES) throw new Error(`That file has more than ${MAX_CUES} captions. Split it into smaller files.`);
  }
  if (!cues.length) throw new Error('No captions were found. Expected SRT or WebVTT cues such as “00:00:01,000 --> 00:00:03,000”.');
  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Splits an over-long cue at word boundaries so it fits one text layer. */
export function splitCaptionText(text: string, limit = CAPTION_TEXT_LIMIT): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed ? [trimmed] : [];
  const words: string[] = [];
  for (const word of trimmed.split(' ')) {
    if (word.length <= limit) { words.push(word); continue; }
    for (let index = 0; index < word.length; index += limit) words.push(word.slice(index, index + limit));
  }
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= limit) current += ` ${word}`;
    else { chunks.push(current); current = word; }
  }
  if (current) chunks.push(current);
  return chunks;
}

function captionLayer(text: string, startTicks: number, durationTicks: number): TextLayer {
  return createTextLayer(Math.max(1, durationTicks), {
    title: text,
    startTicks,
    x: .1,
    y: .79,
    width: .8,
    align: 'center',
    size: .042,
    fontWeight: 600,
    lineHeight: 1.15,
    backdropEnabled: true,
    backdropColor: '#000000',
    backdropOpacity: 72,
    backdropBlur: 10,
    backdropPadding: 20,
    backdropRadius: 10,
    animation: 'fade',
    animationDuration: .18,
  });
}

/**
 * Distributes cues across the existing scenes, clipping each cue to the scene it
 * starts in. Returns only the scenes that changed so the editor can apply one
 * undoable `updateMany` command.
 */
export function placeCaptions(scenes: Scene[], cues: CaptionCue[], timebase: Timebase) {
  const placement: CaptionPlacement = { added: 0, split: 0, skipped: 0, scenes: 0 };
  if (!scenes.length || !cues.length) return { changed: [] as Scene[], placement };
  const ordered = [...cues].sort((a, b) => a.start - b.start || a.end - b.end);
  const working = scenes.map(scene => {
    const layers = [...(scene.textLayers ?? [])];
    if (!layers.length) {
      const legacy = legacyTextLayer(scene);
      if (legacy) layers.push(legacy);
    }
    return { scene, layers, added: 0 };
  });

  for (const cue of ordered) {
    const startTicks = Math.max(0, secondsToTicks(cue.start, timebase));
    const endTicks = Math.max(startTicks + 1, secondsToTicks(cue.end, timebase));
    const target = working.find(entry => startTicks >= entry.scene.startTicks && startTicks < entry.scene.startTicks + entry.scene.durationTicks);
    if (!target || target.layers.length >= MAX_TEXT_LAYERS) { placement.skipped += 1; continue; }
    const localStart = Math.max(0, startTicks - target.scene.startTicks);
    const localEnd = Math.min(target.scene.durationTicks, endTicks - target.scene.startTicks);
    if (localEnd <= localStart) { placement.skipped += 1; continue; }
    const chunks = splitCaptionText(cue.text);
    const capacity = MAX_TEXT_LAYERS - target.layers.length;
    const use = chunks.slice(0, capacity);
    if (!use.length) { placement.skipped += 1; continue; }
    if (chunks.length > 1) placement.split += 1;
    const span = localEnd - localStart;
    const share = Math.max(1, Math.floor(span / use.length));
    use.forEach((text, index) => {
      const start = localStart + share * index;
      const end = index === use.length - 1 ? localEnd : Math.min(localEnd, start + share);
      target.layers.push(captionLayer(text, start, Math.max(1, end - start)));
      target.added += 1;
      placement.added += 1;
    });
  }

  const changed = working.filter(entry => entry.added > 0).map(entry => ({
    ...entry.scene,
    textLayers: entry.layers,
    title: entry.layers[0]?.title ?? '',
    subtitle: entry.layers[0]?.subtitle ?? '',
  }));
  placement.scenes = changed.length;
  return { changed, placement };
}
